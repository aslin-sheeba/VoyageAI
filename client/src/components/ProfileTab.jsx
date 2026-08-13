import { useAuth } from "../context/AuthContext";

export default function ProfileTab({ tripsCount }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to sign out?")) return;
    try {
      await logout();
      window.location.reload();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 text-white max-w-xl mx-auto h-full flex flex-col justify-center pb-24">
      <div className="bg-slate-900/50 border border-white/5 p-8 rounded-3xl text-center flex flex-col items-center shadow-2xl relative overflow-hidden">
        {/* Neon Gradient Accent Ring */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500"></div>

        {/* User Avatar */}
        <div className="relative mb-6">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 blur-md opacity-70 animate-pulse"></div>
          {user.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName || "User avatar"} 
              className="relative w-24 h-24 rounded-full border-2 border-white object-cover"
            />
          ) : (
            <div className="relative w-24 h-24 rounded-full border-2 border-white bg-slate-800 flex items-center justify-center text-4xl">
              👤
            </div>
          )}
        </div>

        {/* User Details */}
        <h2 className="text-2xl font-black mb-1">{user.displayName || "Traveler"}</h2>
        <p className="text-gray-400 text-sm mb-6">{user.email}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 w-full bg-black/20 p-4 rounded-2xl border border-white/5 mb-6">
          <div className="text-center border-r border-white/5">
            <span className="block text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">Trips Planned</span>
            <span className="text-2xl font-black text-sky-400">{tripsCount}</span>
          </div>
          <div className="text-center">
            <span className="block text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">Account Status</span>
            <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider block mt-1.5">Verified</span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-3 rounded-2xl font-bold transition-all duration-300"
        >
          Sign Out of VoyageAI
        </button>
      </div>
    </div>
  );
}
