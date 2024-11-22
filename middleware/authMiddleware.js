const passport = require('../config/passport');

const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: info.message || 'Unauthorized'
      });
    }
    
    req.user = user;
    next();
  })(req, res, next);
};

const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};