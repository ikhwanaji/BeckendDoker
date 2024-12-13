const { pool } = require('../config/db');
const validator = require('validator');

// Validasi input metode pengiriman
const validateShippingMethod = (data) => {
    const errors = {};

    // Validasi nama
    if (!data.nama || data.nama.trim() === '') {
        errors.nama = 'Nama metode pengiriman wajib diisi';
    } else if (data.nama.length > 100) {
        errors.nama = 'Nama tidak boleh lebih dari 100 karakter';
    }

    // Validasi kode
    if (!data.kode || data.kode.trim() === '') {
        errors.kode = 'Kode metode pengiriman wajib diisi';
    } else if (data.kode.length > 50) {
        errors.kode = 'Kode tidak boleh lebih dari 50 karakter';
    }

    // Validasi biaya
    if (data.biaya === undefined || data.biaya === null) {
        errors.biaya = 'Biaya pengiriman wajib diisi';
    } else if (isNaN(parseFloat(data.biaya)) || parseFloat(data.biaya) < 0) {
        errors.biaya = 'Biaya harus berupa angka positif';
    }

    // Validasi estimasi (opsional)
    if (data.estimasi && data.estimasi.length > 50) {
        errors.estimasi = 'Estimasi tidak boleh lebih dari 50 karakter';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

// Mendapatkan semua metode pengiriman
const getAllShippingMethods = async (req, res) => {
    try {
        const { aktif, page = 1, limit = 10, sortBy = 'shippingId', sortOrder = 'ASC' } = req.query;
        
        // Validasi input pagination dan sorting
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let query = 'SELECT * FROM metode_pengiriman';
        let countQuery = 'SELECT COUNT(*) as total FROM metode_pengiriman';
        let queryParams = [];
        let countParams = [];

        // Filter berdasarkan status aktif
        if (aktif !== undefined) {
            query += ' WHERE aktif = ?';
            countQuery += ' WHERE aktif = ?';
            queryParams.push(aktif === 'true' || aktif === '1');
            countParams.push(aktif === 'true' || aktif === '1');
        }

        // Sorting
        query += ` ORDER BY ${sortBy} ${sortOrder}`;

        // Pagination
        query += ' LIMIT ? OFFSET ?';
        queryParams.push(limitNum, offset);

        // Eksekusi query
        const [rows] = await pool.query(query, queryParams);
        const [countResult] = await pool.query(countQuery, countParams);

        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limitNum);

        res.status(200).json({
            status: 'success',
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems,
                itemsPerPage: limitNum
            },
            data: rows
        });
    } catch (error) {
        console.error('Error fetching shipping methods:', error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal mengambil metode pengiriman',
            error: error.message
        });
    }
};

// Mendapatkan metode pengiriman berdasarkan ID
const getShippingMethodById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validasi ID
        if (!validator.isInt(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'ID tidak valid'
            });
        }

        const [rows] = await pool.query('SELECT * FROM metode_pengiriman WHERE shippingId = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Metode pengiriman tidak ditemukan'
            });
        }

        res.status(200).json({
            status: 'success',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching shipping method:', error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal mengambil metode pengiriman',
            error: error.message
        });
    }
};

// Membuat metode pengiriman baru
const createShippingMethod = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        // Mulai transaksi
        await connection.beginTransaction();

        const { nama, kode, estimasi, biaya, aktif = true } = req.body;
        
        // Validasi input
        const validation = validateShippingMethod(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                status: 'error',
                errors: validation.errors
            });
        }

        // Cek duplikasi kode
        const [existingCode] = await connection.query(
            'SELECT * FROM metode_pengiriman WHERE kode = ?', 
            [kode]
        );

        if (existingCode.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Kode metode pengiriman sudah ada'
            });
        }

        // Insert data
        const [result] = await connection.query(
            'INSERT INTO metode_pengiriman (nama, kode, estimasi, biaya, aktif) VALUES (?, ?, ?, ?, ?)', 
            [nama, kode, estimasi, biaya, aktif]
        );

        // Commit transaksi
        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: 'Metode pengiriman berhasil dibuat',
            data: {
                shippingId: result.insertId,
                nama,
                kode,
                estimasi,
                biaya,
                aktif
            }
        });
    } catch (error) {
        // Rollback transaksi jika terjadi error
        await connection.rollback();

        console.error('Error creating shipping method:', error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal membuat metode pengiriman',
            error: error.message
        });
    } finally {
        // Selalu lepaskan koneksi
        connection.release();
    }
};

const updateShippingMethod = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        // Mulai transaksi
        await connection.beginTransaction();

        const { id } = req.params;
        const { nama, kode, estimasi, biaya, aktif } = req.body;
        
        // Validasi ID
        if (!validator.isInt(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'ID tidak valid'
            });
        }

        // Validasi input
        const validation = validateShippingMethod(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                status: 'error',
                errors: validation.errors
            });
        }

        // Cek keberadaan metode pengiriman
        const [existingMethod] = await connection.query(
            'SELECT * FROM metode_pengiriman WHERE shippingId = ?', 
            [id]
        );

        if (existingMethod.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Metode pengiriman tidak ditemukan'
            });
        }

        // Cek duplikasi kode (kecuali kode saat ini)
        const [duplicateCode] = await connection.query(
            'SELECT * FROM metode_pengiriman WHERE kode = ? AND shippingId != ?', 
            [kode, id]
        );

        if (duplicateCode.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Kode metode pengiriman sudah digunakan'
            });
        }

        // Update metode pengiriman
        const [result] = await connection.query(
            'UPDATE metode_pengiriman SET nama = ?, kode = ?, estimasi = ?, biaya = ?, aktif = ? WHERE shippingId = ?', 
            [nama, kode, estimasi, biaya, aktif, id]
        );

        // Commit transaksi
        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Metode pengiriman berhasil diperbarui',
            data: {
                shippingId: id,
                nama,
                kode,
                estimasi,
                biaya,
                aktif
            }
        });
    } catch (error) {
        // Rollback transaksi jika terjadi error
        await connection.rollback();

        console.error('Error updating shipping method:', error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal memperbarui metode pengiriman',
            error: error.message
        });
    } finally {
        // Selalu lepaskan koneksi
        connection.release();
    }
};

// Menghapus metode pengiriman
const deleteShippingMethod = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        // Mulai transaksi
        await connection.beginTransaction();

        const { id } = req.params;
        
        // Validasi ID
        if (!validator.isInt(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'ID tidak valid'
            });
        }

        // Cek apakah metode pengiriman sudah digunakan di transaksi
        const [usedInTransactions] = await connection.query(
            'SELECT COUNT(*) as count FROM pesanan WHERE shippingId = ?', 
            [id]
        );

        if (usedInTransactions[0].count > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Metode pengiriman tidak dapat dihapus karena sudah digunakan dalam transaksi'
            });
        }

        // Hapus metode pengiriman
        const [result] = await connection.query(
            'DELETE FROM metode_pengiriman WHERE shippingId = ?', 
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Metode pengiriman tidak ditemukan'
            });
        }

        // Commit transaksi
        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: 'Metode pengiriman berhasil dihapus'
        });
    } catch (error) {
        // Rollback transaksi jika terjadi error
        await connection.rollback();

        console.error('Error deleting shipping method:', error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal menghapus metode pengiriman',
            error: error.message
        });
    } finally {
        // Selalu lepaskan koneksi
        connection.release();
    }
};

// Mengubah status aktif metode pengiriman
const toggleShippingMethodStatus = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        // Mulai transaksi
        await connection.beginTransaction();

        const { id } = req.params;
        const { aktif } = req.body;

        // Validasi ID
        if (!validator.isInt(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'ID tidak valid'
            });
        }

        // Validasi status aktif
        if (typeof aktif !== 'boolean') {
            return res.status(400).json({
                status: 'error',
                message: 'Status aktif harus boolean'
            });
        }

        // Cek keberadaan metode pengiriman
        const [existingMethod] = await connection.query(
            'SELECT * FROM metode_pengiriman WHERE shippingId = ?', 
            [id]
        );

        if (existingMethod.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Metode pengiriman tidak ditemukan'
            });
        }

        // Update status aktif
        const [result] = await connection.query(
            'UPDATE metode_pengiriman SET aktif = ? WHERE shippingId = ?', 
            [aktif, id]
        );

        // Commit transaksi
        await connection.commit();

        res.status(200).json({
            status: 'success',
            message: `Metode pengiriman berhasil di${aktif ? 'aktifkan' : 'nonaktifkan'}`,
            data: { 
                shippingId: id,
                aktif 
            }
        });
    } catch (error) {
        // Rollback transaksi jika terjadi error
        await connection.rollback();

        console.error('Error toggling shipping method status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Gagal mengubah status metode pengiriman',
            error: error.message
        });
    } finally {
        // Selalu lepaskan koneksi
        connection.release();
    }
};

// Export semua fungsi
module.exports = {
    getAllShippingMethods,
    getShippingMethodById,
    createShippingMethod,
    updateShippingMethod,
    deleteShippingMethod,
    toggleShippingMethodStatus
};