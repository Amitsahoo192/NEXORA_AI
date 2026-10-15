import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        message: "Authorization token required",
      });
    }
    
    // Expected format:
    // Bearer <token>
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Invalid authorization format",
      });
    }
    const token = parts[1];
    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
    // Attach user ID to request
    req.userId = decoded.userId;
    // Continue to route
    next();
  } catch (error) {
    console.error("AUTH ERROR:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};