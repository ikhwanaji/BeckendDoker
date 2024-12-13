const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Pastikan direktori uploads ada
const ensureUploadsDirectory = () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
};

// Konfigurasi storage multer
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDirectory();
    cb(null, path.join(__dirname, '../uploads/users'));
  },
  filename: (req, file, cb) => {
    cb(null, `user-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Filter tipe file gambar
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPEG, PNG, JPG) yang diizinkan'), false);
  }
};

// Konfigurasi upload gambar profil
const uploadProfileImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB
    files: 1, // Batasi hanya 1 file
  },
});

// Middleware untuk validasi upload gambar
const validateImageUpload = (req, res, next) => {
  uploadProfileImage.single('gambar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Error dari multer
      return res.status(400).json({
        status: 'error',
        message: err.message === 'File too large' ? 'Ukuran gambar maksimal 10MB' : 'Gagal mengunggah gambar',
      });
    } else if (err) {
      // Error kustom
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Gagal mengunggah gambar',
      });
    }
    next();
  });
};

// Konfigurasi storage multer untuk artikel
const articleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDirectory();
    cb(null, path.join(__dirname, '../uploads/artikel/'));
  },
  filename: (req, file, cb) => {
    cb(null, `artikel-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Filter tipe file gambar
const articleFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPEG, PNG, JPG) yang diizinkan'), false);
  }
};

// Konfigurasi upload gambar artikel
const uploadArticleImage = multer({
  storage: articleStorage,
  fileFilter: articleFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB
    files: 1, // Batasi hanya 1 file
  },
});

// Middleware untuk validasi upload gambar artikel
const validateArticleImageUpload = (req, res, next) => {
  uploadArticleImage.single('gambar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        status: 'error',
        message: err.message === 'File too large' ? 'Ukuran gambar maksimal 5MB' : 'Gagal mengunggah gambar',
      });
    } else if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Gagal mengunggah gambar',
      });
    }
    next();
  });
};

// Konfigurasi penyimpanan gambar
const produkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDirectory();
    cb(null, path.join(__dirname, '../uploads/produks/'));
  },
  filename: (req, file, cb) => {
    cb(null, `produk-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Filter tipe file gambar
const produkFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPEG, PNG, JPG) yang diizinkan'), false);
  }
};

// Inisialisasi upload
const uploadProdukImage = multer({
  storage: produkStorage,
  fileFilter: produkFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB
    files: 1, // Batasi hanya 1 file
  },
});


// Middleware validasi upload
const validateProdukUpload = (req, res, next) => {
  uploadProdukImage.single('gambar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Tangani error spesifik dari Multer
      let errorMessage = 'Gagal mengunggah gambar';
      
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          errorMessage = 'Ukuran gambar maksimal 10MB';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          errorMessage = 'Terlalu banyak file yang diunggah';
          break;
        case 'LIMIT_FIELD_KEY':
          errorMessage = 'Nama field tidak valid';
          break;
      }

      // Hapus file yang sudah terupload jika ada error
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Gagal menghapus file:', unlinkErr);
          }
        });
      }

      return res.status(400).json({
        status: 'error',
        message: errorMessage,
      });
    } else if (err) {
      // Tangani error lainnya
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Gagal menghapus file:', unlinkErr);
          }
        });
      }

      return res.status(400).json({
        status: 'error',
        message: err.message || 'Gagal mengunggah gambar',
      });
    }

    // Jika tidak ada error, tambahkan path gambar ke body request
    if (req.file) {
      req.body.gambar = `/uploads/produks/${req.file.filename}`;
    }

    next();
  });
};

// Middleware hapus file jika terjadi error
const cleanupUploadedFile = (err, req, res, next) => {
  if (err) {
    // Hapus file yang sudah terupload jika terjadi error
    if (req.file) {
      const filePath = req.file.path;
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Gagal menghapus file:', unlinkErr);
        }
      });
    }

    return res.status(400).json({
      status: 'error',
      message: err.message || 'Gagal mengunggah gambar'
    });
  }
  next();
};




const paketStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDirectory();
    cb(null, path.join(__dirname, '../uploads/paket/'));
  },
  filename: (req, file, cb) => {
    cb(null, `paket-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Filter tipe file gambar
const paketFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPEG, PNG, JPG) yang diizinkan'), false);
  }
};

// Inisialisasi upload
const uploadPaketImage = multer({
  storage: paketStorage,
  fileFilter: paketFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB
    files: 1, // Batasi hanya 1 file
  },
});


// Middleware validasi upload
const validatePaketUpload = (req, res, next) => {
  uploadPaketImage.single('gambar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Tangani error spesifik dari Multer
      let errorMessage = 'Gagal mengunggah gambar';
      
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          errorMessage = 'Ukuran gambar maksimal 10MB';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          errorMessage = 'Terlalu banyak file yang diunggah';
          break;
        case 'LIMIT_FIELD_KEY':
          errorMessage = 'Nama field tidak valid';
          break;
      }

      // Hapus file yang sudah terupload jika ada error
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Gagal menghapus file:', unlinkErr);
          }
        });
      }

      return res.status(400).json({
        status: 'error',
        message: errorMessage,
      });
    } else if (err) {
      // Tangani error lainnya
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Gagal menghapus file:', unlinkErr);
          }
        });
      }

      return res.status(400).json({
        status: 'error',
        message: err.message || 'Gagal mengunggah gambar',
      });
    }

    // Jika tidak ada error, tambahkan path gambar ke body request
    if (req.file) {
      req.body.gambar = `/uploads/paket/${req.file.filename}`;
    }

    next();
  });
};


module.exports = {
  uploadProfileImage,
  validateImageUpload,
  uploadArticleImage,
  validateArticleImageUpload,
  uploadProdukImage,
  validateProdukUpload,
  cleanupUploadedFile,
  uploadPaketImage,
  validatePaketUpload
};
