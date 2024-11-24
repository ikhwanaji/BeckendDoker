// middleware/errorMiddleware.js

// Middleware untuk handle 404 (not found)
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404).json({
      status: 'error',
      message: 'Endpoint tidak ditemukan',
      path: req.originalUrl
    });
  };
  
  // Middleware untuk error handling global
  const errorHandler = (err, req, res, next) => {
    // Tentukan status code
    const statusCode = err.status || 500;
    
    // Logging error (bisa menggunakan winston/morgan di production)
    console.error('Error:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : null,
      path: req.originalUrl,
      method: req.method
    });
  
    // Response error
    res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Terjadi kesalahan internal server',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err
      })
    });
  };
  
  // Middleware validasi input umum
  const validateRequest = (schema) => {
    return (req, res, next) => {
      const { error } = schema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Validasi gagal',
          errors: error.details.map(detail => ({
            message: detail.message,
            path: detail.path
          }))
        });
      }
      
      next();
    };
  };
  
  module.exports = {
    notFoundHandler,
    errorHandler,
    validateRequest
  };