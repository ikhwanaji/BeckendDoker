const { pool } = require('../config/db');
const midtransClient = require('midtrans-client');

// Konfigurasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY_SANDBOX,
  clientKey: process.env.MIDTRANS_CLIENT_KEY_SANDBOX,
});

// Tambahkan logging
console.log('Midtrans Configuration:', {
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY_SANDBOX ? 'Present' : 'Missing',
  clientKey: process.env.MIDTRANS_CLIENT_KEY_SANDBOX ? 'Present' : 'Missing',
  scriptUrl: 'https://app.sandbox.midtrans.com/snap/snap.js',
});

// Fungsi untuk membuat pemesanan
const createOrder = async (req, res) => {
  const { userId, paketId, jumlah, total_harga, metode_pembayaran, shippingId, catatan } = req.body;

  // Validasi input
  if (!userId || !paketId || !jumlah || !total_harga || !metode_pembayaran) {
    return res.status(400).json({
      message: 'Data pemesanan belum lengkap',
      requiredFields: ['userId', 'paketId', 'jumlah', 'total_harga', 'metode_pembayaran'],
    });
  }

  const connection = await pool.getConnection();

  try {
    // Mulai transaksi
    await connection.beginTransaction();

    // Ambil detail user
    const [userRows] = await connection.query('SELECT nama, email, no_hp FROM users WHERE userId = ?', [userId]);

    if (userRows.length === 0) {
      throw new Error('User tidak ditemukan');
    }

    const userData = userRows[0];

    // Cek stok paket
    const [paketRows] = await connection.query('SELECT title, stok FROM paket WHERE paketId = ?', [paketId]);

    if (paketRows.length === 0 || paketRows[0].stok < jumlah) {
      throw new Error('Stok paket tidak mencukupi');
    }

    const paketData = paketRows[0];

    // Kurangi stok paket
    await connection.query('UPDATE paket SET stok = stok - ? WHERE paketId = ?', [jumlah, paketId]);

    // Generate unique order ID
    const orderId = `ORDER-${Date.now()}`;

    // Fungsi untuk memotong nama
    const truncateName = (name, maxLength = 50) => {
      return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
    };

    const [shippingRows] = await connection.query('SELECT biaya FROM metode_pengiriman WHERE shippingId = ?', [shippingId]);

    if (shippingRows.length === 0) {
      throw new Error('Metode pengiriman tidak valid');
    }

    const biayaPengiriman = shippingRows[0].biaya;

    // Hitung ulang harga untuk memastikan konsistensi
    const itemPrice = Math.round(total_harga / jumlah);
    const calculatedTotalPrice = itemPrice * jumlah + biayaPengiriman;

    // Persiapkan parameter Midtrans
    const midtransParams = {
      transaction_details: {
        order_id: orderId,
        gross_amount: calculatedTotalPrice,
      },
      customer_details: {
        first_name: truncateName(userData.nama),
        email: userData.email,
        phone: userData.no_hp,
      },
      item_details: [
        {
          id: paketId.toString(),
          price: itemPrice,
          quantity: jumlah,
          name: truncateName(paketData.title), // Potong nama paket
        },
        {
          id: 'shipping',
          price: biayaPengiriman,
          quantity: 1,
          name: 'Biaya Pengiriman',
        },
      ],
    };

    console.log('Midtrans Params:', JSON.stringify(midtransParams, null, 2));

    // Buat transaksi Midtrans
    const midtransResponse = await snap.createTransaction(midtransParams);

    console.log(midtransResponse);

    console.log('Midtrans Response:', {
      token: midtransResponse.token,
      redirectUrl: midtransResponse.redirect_url,
    });

    // Simpan pesanan ke database
    const [result] = await connection.query(
      `INSERT INTO pemesanan_paketan 
        (userId, paketId, jumlah, total_harga, metode_pembayaran, 
        shippingId, catatan, midtrans_order_id, midtrans_transaction_token, status_pembayaran) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, paketId, jumlah, calculatedTotalPrice, metode_pembayaran, shippingId, catatan, orderId, midtransResponse.token, 'pending']
    );

    // Commit transaksi
    await connection.commit();

    res.status(201).json({
      message: 'Pesanan berhasil dibuat',
      orderId: result.insertId,
      midtransOrderId: orderId,
      midtransToken: midtransResponse.token,
      redirectUrl: midtransResponse.redirect_url,
    });
  } catch (error) {
    // Rollback transaksi jika terjadi kesalahan
    await connection.rollback();
    console.error('Error creating order:', error);
    console.error('Full Error Details:', JSON.stringify(error, null, 2));

    // Kembalikan stok paket jika transaksi gagal
    try {
      await connection.query('UPDATE paket SET stok = stok + ? WHERE paketId = ?', [jumlah, paketId]);
    } catch (rollbackError) {
      console.error('Error rolling back stock:', rollbackError);
    }

    res.status(500).json({
      message: 'Gagal membuat pesanan',
      error: error.message,
      details: error.toString(),
    });
  } finally {
    connection.release();
  }
};

const updatePaymentStatus = async (req, res) => {
  const { orderId, status } = req.body;

  if (!orderId || !status) {
    return res.status(400).json({ message: 'Order ID dan status diperlukan' });
  }

  try {
    const [result] = await pool.query('UPDATE pemesanan_paketan SET status_pembayaran = ? WHERE midtrans_order_id = ?', [status, orderId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Status pembayaran berhasil diperbarui',
      updatedRows: result.affectedRows,
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      message: 'Gagal memperbarui status pembayaran',
      error: error.message,
    });
  }
};

const getRiwayatPemesanan = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Query to fetch order history with comprehensive error handling
    const [results] = await pool.query(
      `SELECT 
        p.midtrans_order_id,
        p.userId, 
        p.status_pembayaran,
        p.status_pengiriman,
        p.created_at,
        COALESCE(pr.harga, 0) as harga,
        COALESCE(p.jumlah, 1) as jumlah,
        COALESCE(p.total_harga, pr.harga * COALESCE(p.jumlah, 1)) as total_harga,
        COALESCE(pr.title, 'paket Tidak Dikenal') AS nama_paket, 
        COALESCE(pr.gambar, '/path/to/placeholder-image.jpg') AS gambar_paket,
        COALESCE(s.nama, 'Tidak Diketahui') AS nama_shipping,
        COALESCE(s.biaya, 0) as biaya_pengiriman
      FROM pemesanan_paketan p
      LEFT JOIN paket pr ON p.paketId = pr.paketId
      LEFT JOIN metode_pengiriman s ON p.shippingId = s.shippingId
      WHERE p.userId = ? AND p.status_pembayaran = 'success'
      ORDER BY p.created_at DESC`,
      [userId]
    );

    // Log for debugging
    console.log(`Orders found for user ${userId}: ${results.length}`);

    res.status(200).json({
      data: results,
      totalItems: results.length,
    });
  } catch (error) {
    console.error('Detailed Order Retrieval Error:', error);
    res.status(500).json({
      message: 'Gagal mengambil riwayat pemesanan',
      error: error.message,
    });
  }
};

const getPemesananById = async (req, res) => {
  const { orderId } = req.params;

  if (!orderId) {
    return res.status(400).json({ message: 'ID pesanan diperlukan' });
  }

  try {
    // Query untuk mengambil detail pemesanan
    const [result] = await pool.query(
      `
      SELECT 
        p.*,
        pr.title AS nama_paket,
        pr.gambar AS gambar_paket,
        pr.harga AS harga_paket,
        u.nama AS nama_pelanggan,
        u.email AS email_pelanggan,
        u.no_hp AS telepon_pelanggan,
        u.alamat, 
        s.nama AS metode_pengiriman,
        s.estimasi,
        s.biaya AS biaya_pengiriman
      FROM pemesanan_paketan p
      JOIN paket pr ON p.paketId = pr.paketId
      JOIN users u ON p.userId = u.userId
      LEFT JOIN metode_pengiriman s ON p.shippingId = s.shippingId
      WHERE p.midtrans_order_id = ? OR p.order_paketId = ?
      `,
      [orderId, orderId]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    // Format data untuk frontend
    const orderData = {
      orderNumber: result[0].midtrans_order_id,
      order_paketId: result[0].order_paketId,
      status: result[0].status_pembayaran,
      tanggal: result[0].created_at,
      customer: {
        name: result[0].nama_pelanggan,
        email: result[0].email_pelanggan,
        phone: result[0].telepon_pelanggan,
        address: result[0].alamat, // Ambil langsung dari tabel users
        country: 'Indonesia',
      },
      shipping: {
        method: result[0].metode_pengiriman,
        estimatedDelivery: result[0].estimasi || '3-5 hari kerja',
        cost: result[0].biaya_pengiriman,
      },
      items: [
        {
          name: result[0].nama_paket,
          price: result[0].harga_paket,
          qty: result[0].jumlah,
          subtotal: result[0].harga_paket * result[0].jumlah,
          image: result[0].gambar_paket || '/api/placeholder/80/80',
          notes: result[0].catatan,
        },
      ],
      summary: {
        subtotal: result[0].harga_paket * result[0].jumlah,
        shipping: result[0].biaya_pengiriman,
        total: result[0].total_harga,
      },
      payment: {
        method: result[0].metode_pembayaran,
        status: result[0].status_pembayaran,
      },
    };

    res.status(200).json({
      success: true,
      data: orderData,
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      message: 'Gagal mengambil detail pesanan',
      error: error.message,
    });
  }
};

const getAllPemesananPaket = async (req, res) => {
  try {
    // Tambahkan opsi pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Filter status jika ada
    const statusFilter = req.query.status ? `AND p.status_pembayaran = '${req.query.status}'` : '';

    // Filter tanggal jika ada
    const dateFilter = req.query.date ? `AND DATE(p.created_at) = '${req.query.date}'` : '';

    // Query total data untuk pagination
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM pemesanan_paketan p WHERE 1=1 ${statusFilter} ${dateFilter}`);

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // Query untuk mengambil data pemesanan dengan informasi lengkap
    const [orders] = await pool.query(
      `SELECT 
        p.midtrans_order_id,
        p.order_paketId,
        p.userId, 
        u.nama AS nama_pelanggan,
        u.email AS email_pelanggan,
        u.no_hp AS no_hp_pelanggan,
        u.alamat AS alamat_pelanggan,
        p.status_pembayaran,
        p.status_pengiriman,
        p.created_at,
        COALESCE(pr.harga, 0) as harga_paket,
        COALESCE(p.jumlah, 1) as jumlah,
        COALESCE(p.total_harga, pr.harga * COALESCE(p.jumlah, 1)) as total_harga,
        COALESCE(pr.title, 'paket Tidak Dikenal') AS nama_paket, 
        COALESCE(pr.gambar, '/path/to/placeholder-image.jpg') AS gambar_paket,
        COALESCE(s.nama, 'Tidak Diketahui') AS nama_shipping,
        COALESCE(s.biaya, 0) as biaya_pengiriman,
        p.catatan
      FROM pemesanan_paketan p
      LEFT JOIN paket pr ON p.paketId = pr.paketId
      LEFT JOIN users u ON p.userId = u.userId
      LEFT JOIN metode_pengiriman s ON p.shippingId = s.shippingId
      WHERE 1=1 ${statusFilter} ${dateFilter}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Log untuk debugging
    console.log(`Total orders: ${totalItems}, Page: ${page}/${totalPages}, Orders on this page: ${orders.length}`);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({
      message: 'Gagal mengambil data pemesanan',
      error: error.message,
    });
  }
};

// Fungsi untuk mengubah status pengiriman
const updateShippingStatusPaket = async (req, res) => {
  const { orderId } = req.params;
  const { status_pengiriman } = req.body;

  if (!orderId || !status_pengiriman) {
    return res.status(400).json({ message: 'Order ID dan status pengiriman diperlukan' });
  }

  const validStatus = ['diproses', 'dikirim', 'selesai', 'dibatalkan'];
  if (!validStatus.includes(status_pengiriman)) {
    return res.status(400).json({
      message: 'Status pengiriman tidak valid',
      validStatus,
    });
  }

  try {
    const [result] = await pool.query('UPDATE pemesanan_paketan SET status_pengiriman = ? WHERE midtrans_order_id = ? ', [status_pengiriman, orderId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    res.status(200).json({
      success: true,
      message: 'Status pengiriman berhasil diperbarui',
      updatedStatus: status_pengiriman,
    });
  } catch (error) {
    console.error('Error updating shipping status:', error);
    res.status(500).json({
      message: 'Gagal memperbarui status pengiriman',
      error: error.message,
    });
  }
};

// Tambahkan fungsi ini ke module.exports
module.exports = {
  createOrder,
  updatePaymentStatus,
  getRiwayatPemesanan,
  getPemesananById,
  getAllPemesananPaket,
  updateShippingStatusPaket,
};
