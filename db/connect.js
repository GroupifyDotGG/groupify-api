cat > /var/www/groupify.gg/api/db/connect.js <<'EOF'
import mongoose from "mongoose";

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  console.warn("[DB] MONGODB_URI is not set — DB routes will time out.");
} else {
  mongoose
    .connect(MONGODB_URI, {
      // If your URI already has dbName param, this is optional
      dbName: "groupify",
    })
    .then(() => console.log("✅ API connected to Mongo"))
    .catch((err) => console.error("❌ API Mongo connect error:", err.message));
}

export default mongoose;
EOF
