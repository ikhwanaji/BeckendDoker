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
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    cb(null, `user-${Date.now()}${path.extname(file.originalname)}`);
  }
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
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1 // Batasi hanya 1 file
  }
});

// Middleware untuk validasi upload gambar
const validateImageUpload = (req, res, next) => {
  uploadProfileImage.single('gambar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Error dari multer
      return res.status(400).json({
        status: 'error',
        message: err.message === 'File too large' 
          ? 'Ukuran gambar maksimal 5MB' 
          : 'Gagal mengunggah gambar'
      });
    } else if (err) {
      // Error kustom
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Gagal mengunggah gambar'
      });
    }
    next();
  });
};

module.exports = {
  uploadProfileImage,
  validateImageUpload
};