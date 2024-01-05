const express = require("express");
const {
  createUser,
  verifyEmail,
  resendVerificationLink,
  logIn,
  updateUser,
  deleteUser,
  fetchAllUsers,
  fetchUserData,
  resetPassword,
  addDeposit,
  getDeposit,
  getAllDeposit,
  addWithdraw,
  getWithdraw,
  getInvestment,
  getTotals,
  getPlan,
  addPlan,
  updatePlan,
  deletePlan,
  getPurchase,
  addPurchase,
  updatePurchase,
  deletePurchase,
  getSinglePlan,
  createInvesment,
  manualUpdateProfit,
  addPaymentMethod,
  getPaymentMethod,
  fetchSite,
  getExternal,
  fetchRefEarnings,
  editPassword,
  editEmail,
  updateUserPhoto,
  messageSupport,
  getSinglePurchase,
  createPurchase,
  fetchUserPurchase,
  addFAQ,
  fetchFAQ,
  updateFAQ,
  deleteFAQ,
  getNewsExternal,
  getNews,
  editSite,
  addNewTestimony,
  getTestimonies,
  deleteTestimony,
  updateTestimony,
  getOneTestimony,
  fetchSingleFAQ,
  fetAllDataLength,
  adminDeleteUser,
  adminUpdateUser,
  updateDeposit,
  getAllWithdraw,
  updateWithdraw,
  getAdminInvestment,
  fetchAdminPurchase,
  fetchSupportMsg,
  updateSupportMsg,
  adminSendEmail,
  adminDeleteEmail,
  fetchNotification,
  updateNotification,
  deleteNotification,
  fetchRate,
} = require("./controllers");
const { authenticateToken, upload, isAdminAuth } = require("./middlewares");
const router = express.Router();

router.post("/user", createUser);
router.put("/user/verify", verifyEmail);
router.post("/user/resend-email", resendVerificationLink);
router.post("/user/login", logIn);
router.put("/user/edit_password", authenticateToken, editPassword);
router.put("/user/edit_email", authenticateToken, editEmail);
router.put("/user", authenticateToken, updateUser);
router.put(
  "/user/image",
  upload.single("photo"),
  authenticateToken,
  updateUserPhoto
);
router.delete("/user", authenticateToken, deleteUser);
router.get("/admin/user", authenticateToken, isAdminAuth, fetchAllUsers);
router.put(
  "/admin/user/:email",
  authenticateToken,
  isAdminAuth,
  adminUpdateUser
);
router.delete(
  "/admin/user/:email",
  authenticateToken,
  isAdminAuth,
  adminDeleteUser
);
router.get("/user", authenticateToken, fetchUserData);
router.post("/deposit", authenticateToken, addDeposit);
router.post("/withdraw", authenticateToken, addWithdraw);
router.post("/invest/:plan", authenticateToken, createInvesment);
router.put("/invest/:id", authenticateToken, manualUpdateProfit);
router.get("/admin/deposit", authenticateToken, isAdminAuth, getAllDeposit);
router.get("/deposit", authenticateToken, getDeposit);
router.get("/withdraw", authenticateToken, getWithdraw);
router.get("/admin/withdraw", authenticateToken, isAdminAuth, getAllWithdraw);
router.get("/total", authenticateToken, getTotals);
router.put("/deposit", authenticateToken, isAdminAuth, updateDeposit);
router.put("/withdraw", authenticateToken, isAdminAuth, updateWithdraw);
router.get("/invest", authenticateToken, getInvestment);
router.get("/admin/invest", authenticateToken, isAdminAuth, getAdminInvestment);
router.get(
  "/admin/purchase",
  authenticateToken,
  isAdminAuth,
  fetchAdminPurchase
);
router.get("/user/purchase", authenticateToken, fetchUserPurchase);
router.get("/plan", getPlan);
router.get("/plan/:name", authenticateToken, getSinglePlan);
router.get("/purchase/:name", authenticateToken, getSinglePurchase);
router.post("/plan", authenticateToken, isAdminAuth, addPlan);
router.put("/plan/:name", authenticateToken, isAdminAuth, updatePlan);
router.delete("/plan/:id", authenticateToken, isAdminAuth, deletePlan);
router.get("/purchase", getPurchase);
router.post("/purchase", authenticateToken, isAdminAuth, addPurchase);
router.post("/purchase/:name", authenticateToken, createPurchase);
router.put("/purchase/:name", authenticateToken, isAdminAuth, updatePurchase);
router.delete("/purchase/:id", authenticateToken, isAdminAuth, deletePurchase);
router.post("/payment", authenticateToken, isAdminAuth, addPaymentMethod);
router.get("/payment", getPaymentMethod);
router.get("/site", fetchSite);
router.put("/site", authenticateToken, isAdminAuth, editSite);
router.get("/rate", fetchRate);
router.get("/referral", authenticateToken, fetchRefEarnings);
router.post("/support", messageSupport);
router.get("/support", authenticateToken, isAdminAuth, fetchSupportMsg);
router.put("/support/:id", authenticateToken, isAdminAuth, updateSupportMsg);
router.post("/faq", authenticateToken, isAdminAuth, addFAQ);
router.get("/faq", fetchFAQ);
router.get("/faq/:id", authenticateToken, isAdminAuth, fetchSingleFAQ);
router.get("/news", getNews);
router.put("/faq/:id", authenticateToken, isAdminAuth, updateFAQ);
router.delete("/faq/:id", authenticateToken, isAdminAuth, deleteFAQ);
router.post(
  "/testimony",
  authenticateToken,
  isAdminAuth,
  upload.fields([{ name: "photo" }, { name: "video" }]),
  addNewTestimony
);
router.get("/testimony", getTestimonies);
router.get("/testimony/:id", authenticateToken, getOneTestimony);
router.delete(
  "/testimony/:id",
  authenticateToken,
  isAdminAuth,
  deleteTestimony
);
router.put(
  "/testimony/:id",
  authenticateToken,
  isAdminAuth,
  upload.fields([{ name: "photo" }, { name: "video" }]),
  updateTestimony
);
router.get("/admin/total", authenticateToken, isAdminAuth, fetAllDataLength);
router.post("/admin/email", authenticateToken, isAdminAuth, adminSendEmail);
router.delete(
  "/admin/email/:id",
  authenticateToken,
  isAdminAuth,
  adminDeleteEmail
);
router.put("/notification/:id", authenticateToken, updateNotification);
router.delete("/notification/:id", authenticateToken, deleteNotification);
router.get("/notification", authenticateToken, fetchNotification);
module.exports = router;
