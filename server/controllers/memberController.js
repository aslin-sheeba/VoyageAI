import Trip from "../models/Trip.js";
import User from "../models/User.js";

// Helper: Is the requesting user the owner of this trip?
function isOwner(trip, uid) {
  return trip.userId === uid;
}

// ─────────────────────────────────────────
// POST /api/trips/:tripId/members
// Invite a user by email (owner only)
// ─────────────────────────────────────────
export const inviteMember = async (req, res) => {
  try {
    const uid    = req.user.uid;
    const { tripId } = req.params;
    const { email }  = req.body;

    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, error: "Trip not found" });
    if (!isOwner(trip, uid)) return res.status(403).json({ success: false, error: "Only the trip owner can invite members" });

    // Prevent self-invite
    const ownerParticipant = trip.participants.find(p => p.userId === uid);
    if (ownerParticipant && ownerParticipant.email === email) {
      return res.status(400).json({ success: false, error: "You cannot invite yourself" });
    }

    // Check if already a participant (any status)
    const already = trip.participants.find(p => p.email === email);
    if (already) {
      if (already.status === "declined") {
        // Re-invite: reset to invited
        already.status   = "invited";
        already.joinedAt = new Date();
        await trip.save();
        return res.json({ success: true, message: "Re-invitation sent", trip });
      }
      return res.status(409).json({ success: false, error: `This user is already a ${already.status === "accepted" ? "member" : "pending invitee"}` });
    }

    // Find registered user by email
    const invitedUser = await User.findOne({ email }).lean();
    if (!invitedUser) {
      return res.status(404).json({ success: false, error: "No registered user found with this email. They must sign up first." });
    }

    // Create invitation entry
    trip.participants.push({
      userId:   invitedUser.uid,
      name:     invitedUser.name  || email.split("@")[0],
      email:    invitedUser.email || email,
      photoURL: invitedUser.photoURL || "",
      role:     "member",
      status:   "invited",
      joinedAt: new Date(),
    });

    await trip.save();
    res.json({ success: true, message: `Invitation created for ${email}`, trip });
  } catch (err) {
    console.error("inviteMember error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────
// GET /api/trips/:tripId/members
// List all participants (any member of the trip)
// ─────────────────────────────────────────
export const listMembers = async (req, res) => {
  try {
    const uid    = req.user.uid;
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId).lean();
    if (!trip) return res.status(404).json({ success: false, error: "Trip not found" });

    // Must be a participant or owner
    const hasAccess =
      trip.userId === uid ||
      trip.participants?.some(p => p.userId === uid && p.status === "accepted");

    if (!hasAccess) return res.status(403).json({ success: false, error: "Access denied" });

    res.json({ success: true, participants: trip.participants || [] });
  } catch (err) {
    console.error("listMembers error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────
// DELETE /api/trips/:tripId/members/:targetUserId
// Remove member or cancel invite (owner only; member can remove themselves)
// ─────────────────────────────────────────
export const removeMember = async (req, res) => {
  try {
    const uid            = req.user.uid;
    const { tripId, targetUserId } = req.params;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, error: "Trip not found" });

    const ownerOp  = isOwner(trip, uid);
    const selfOp   = uid === targetUserId; // member removing themselves

    if (!ownerOp && !selfOp) {
      return res.status(403).json({ success: false, error: "Only the owner can remove members" });
    }

    // Prevent owner removal
    const target = trip.participants.find(p => p.userId === targetUserId);
    if (!target) return res.status(404).json({ success: false, error: "Participant not found" });
    if (target.role === "owner") return res.status(400).json({ success: false, error: "Cannot remove the trip owner" });

    trip.participants = trip.participants.filter(p => p.userId !== targetUserId);
    await trip.save();
    res.json({ success: true, message: "Participant removed", trip });
  } catch (err) {
    console.error("removeMember error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────
// GET /api/invitations
// List all pending invitations for the authenticated user
// ─────────────────────────────────────────
export const listInvitations = async (req, res) => {
  try {
    const uid   = req.user.uid;
    const email = req.user.email || "";

    // MongoDB doesn't support $or inside $elemMatch — use $or at top level instead
    const orConditions = [
      { participants: { $elemMatch: { userId: uid, status: "invited" } } },
    ];
    if (email) {
      orConditions.push(
        { participants: { $elemMatch: { email, status: "invited" } } }
      );
    }

    const trips = await Trip.find({ $or: orConditions }).lean();

    const invitations = trips.map(trip => {
      const inv = trip.participants.find(
        p => (p.userId === uid || p.email === email) && p.status === "invited"
      );
      if (!inv) return null;
      return {
        tripId:   trip._id,
        tripName: trip.tripName,
        city:     trip.city,
        days:     trip.days,
        invitation: inv,
      };
    }).filter(Boolean);

    res.json({ success: true, invitations });
  } catch (err) {
    console.error("listInvitations error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────
// POST /api/invitations/:tripId/accept
// ─────────────────────────────────────────
export const acceptInvitation = async (req, res) => {
  try {
    const uid        = req.user.uid;
    const email      = req.user.email || "";
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, error: "Trip not found" });

    const inv = trip.participants.find(
      p => (p.userId === uid || p.email === email) && p.status === "invited"
    );
    if (!inv) return res.status(404).json({ success: false, error: "Invitation not found" });

    inv.status   = "accepted";
    inv.userId   = uid;   // ensure userId is set (may have been invited before registration)
    inv.joinedAt = new Date();
    await trip.save();

    res.json({ success: true, message: `You have joined ${trip.tripName}`, trip });
  } catch (err) {
    console.error("acceptInvitation error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────
// POST /api/invitations/:tripId/decline
// ─────────────────────────────────────────
export const declineInvitation = async (req, res) => {
  try {
    const uid        = req.user.uid;
    const email      = req.user.email || "";
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, error: "Trip not found" });

    const inv = trip.participants.find(
      p => (p.userId === uid || p.email === email) && p.status === "invited"
    );
    if (!inv) return res.status(404).json({ success: false, error: "Invitation not found" });

    inv.status = "declined";
    await trip.save();

    res.json({ success: true, message: "Invitation declined" });
  } catch (err) {
    console.error("declineInvitation error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
