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
const createPemesanan = async (req, res) => {
  const { userId, produkId, jumlah, total_harga, metode_pembayaran, shippingId, catatan } = req.body;

  // Validasi input
  if (!userId || !produkId || !jumlah || !total_harga || !metode_pembayaran) {
    return res.status(400).json({
      message: 'Data pemesanan tidak lengkap',
      requiredFields: ['userId', 'produkId', 'jumlah', 'total_harga', 'metode_pembayaran'],
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

    // Cek stok produk
    const [produkRows] = await connection.query('SELECT nama, stok FROM produk WHERE produkId = ?', [produkId]);

    if (produkRows.length === 0 || produkRows[0].stok < jumlah) {
      throw new Error('Stok produk tidak mencukupi');
    }

    const produkData = produkRows[0];

    // Kurangi stok produk
    await connection.query('UPDATE produk SET stok = stok - ? WHERE produkId = ?', [jumlah, produkId]);

    // Generate unique order ID
    const orderId = `ORDER-${Date.now()}-${userId}`;

    // Fungsi untuk memotong nama
    const truncateName = (name, maxLength = 50) => {
      return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
    };

    // Hitung ulang harga untuk memastikan konsistensi
    const itemPrice = Math.round(total_harga / jumlah);
    const calculatedTotalPrice = itemPrice * jumlah;

    // Persiapkan parameter Midtrans
    const midtransParams = {
      transaction_details: {
        order_id: orderId,
        gross_amount: calculatedTotalPrice, // Gunakan total harga yang dibulatkan
      },
      customer_details: {
        first_name: truncateName(userData.nama),
        email: userData.email,
        phone: userData.no_hp,
      },
      item_details: [
        {
          id: produkId.toString(),
          price: itemPrice,
          quantity: jumlah,
          name: truncateName(produkData.nama), // Potong nama produk
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
      `INSERT INTO pemesanan 
        (userId, produkId, jumlah, total_harga, metode_pembayaran, 
        shippingId, catatan, midtrans_order_id, midtrans_transaction_token, status_pembayaran) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, produkId, jumlah, calculatedTotalPrice, metode_pembayaran, shippingId, catatan, orderId, midtransResponse.token, 'pending']
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

    // Kembalikan stok produk jika transaksi gagal
    try {
      await connection.query('UPDATE produk SET stok = stok + ? WHERE produkId = ?', [jumlah, produkId]);
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

const getRiwayatPemesanan = async (req, res) => {
  const userId = req.user.id; // Dari middleware autentikasi
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Query untuk mengambil riwayat pemesanan dengan join ke tabel produk
    const [results] = await pool.query(
      `
      SELECT 
        p.*, 
        pr.nama AS nama_produk, 
        pr.gambar AS gambar_produk,
        s.nama AS nama_shipping
      FROM pemesanan p
      JOIN produk pr ON p.produkId = pr.produkId
      LEFT JOIN metode_pengiriman s ON p.shippingId = s.shippingId
      WHERE p.userId = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [userId, limit, offset]
    );

    // Hitung total halaman
    const [countResult] = await pool.query(
      `
      SELECT COUNT(*) AS total 
      FROM pemesanan 
      WHERE userId = ?
    `,
      [userId]
    );

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      data: results,
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
    });
  } catch (error) {
    console.error('Gagal mengambil riwayat pemesanan:', error);
    res.status(500).json({
      message: 'Gagal mengambil riwayat pemesanan',
      error: error.message,
    });
  }
};

module.exports = {
  createPemesanan,
  getRiwayatPemesanan,
};
