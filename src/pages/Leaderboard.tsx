import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";
import { Trophy, Coins, ShoppingBag, CheckCircle } from "lucide-react";
import clsx from "clsx";

interface LeaderboardUser {
  id: string;
  championName: string;
  cap: number;
  requestsMade: number;
  requestsAccepted: number;
}

export function Leaderboard() {
  const [usersByCap, setUsersByCap] = useState<LeaderboardUser[]>([]);
  const [usersByMade, setUsersByMade] = useState<LeaderboardUser[]>([]);
  const [usersByAccepted, setUsersByAccepted] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboards = async () => {
      try {
        // Fetch top by CAP
        const qCap = query(collection(db, "users"), orderBy("cap", "desc"), limit(10));
        const snapCap = await getDocs(qCap);
        const topCap: LeaderboardUser[] = [];
        snapCap.forEach(doc => {
          if (doc.data().championName) topCap.push({ id: doc.id, ...doc.data() } as LeaderboardUser);
        });
        setUsersByCap(topCap);

        // Fetch top by Requests Made
        const qMade = query(collection(db, "users"), orderBy("requestsMade", "desc"), limit(10));
        const snapMade = await getDocs(qMade);
        const topMade: LeaderboardUser[] = [];
        snapMade.forEach(doc => {
          if (doc.data().championName) topMade.push({ id: doc.id, ...doc.data() } as LeaderboardUser);
        });
        setUsersByMade(topMade);

        // Fetch top by Requests Accepted
        const qAccepted = query(collection(db, "users"), orderBy("requestsAccepted", "desc"), limit(10));
        const snapAccepted = await getDocs(qAccepted);
        const topAccepted: LeaderboardUser[] = [];
        snapAccepted.forEach(doc => {
          if (doc.data().championName) topAccepted.push({ id: doc.id, ...doc.data() } as LeaderboardUser);
        });
        setUsersByAccepted(topAccepted);

      } catch (err) {
        console.error("Error fetching leaderboard", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboards();
  }, []);

  if (loading) {
    return <div className="text-center py-10">Cargando Ranking...</div>;
  }

  const renderList = (users: LeaderboardUser[], getVal: (u: LeaderboardUser) => number | string, unit: string, icon: React.ReactNode) => (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {users.length === 0 ? (
          <li className="px-6 py-4 text-center text-sm text-gray-500">No hay datos aún.</li>
        ) : users.map((u, idx) => (
          <li key={u.id}>
            <div className="px-4 py-4 flex items-center sm:px-6">
              <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-center">
                  <span className={clsx(
                    "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-white",
                    idx === 0 ? "bg-yellow-400" :
                    idx === 1 ? "bg-gray-400" :
                    idx === 2 ? "bg-yellow-700" : "bg-blue-100 text-blue-800"
                  )}>
                    {idx + 1}
                  </span>
                  <div className="ml-4">
                    <p className="font-medium text-blue-600 truncate">{u.championName}</p>
                  </div>
                </div>
                <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5">
                  <div className="flex items-center text-sm text-gray-500 font-bold">
                    {icon}
                    <span className="ml-2">
                      {getVal(u)} {unit}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Trophy className="h-6 w-6 text-yellow-500 mr-2" />
          Ranking de Champions
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Los mejores entre los mejores.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* TOP CAP */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Coins className="h-5 w-5 text-green-500 mr-2" />
            Más Ricos (CAP)
          </h2>
          {renderList(usersByCap, u => u.cap || 0, "CAP", <Coins className="h-4 w-4 text-green-500" />)}
        </div>

        {/* TOP PEDIDOS REALIZADOS */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ShoppingBag className="h-5 w-5 text-blue-500 mr-2" />
            Más Pedidos Hechos
          </h2>
          {renderList(usersByMade, u => u.requestsMade || 0, "pedidos", <ShoppingBag className="h-4 w-4 text-blue-500" />)}
        </div>

        {/* TOP PEDIDOS ACEPTADOS */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-purple-500 mr-2" />
            Más Pedidos Aceptados
          </h2>
          {renderList(usersByAccepted, u => u.requestsAccepted || 0, "aceptados", <CheckCircle className="h-4 w-4 text-purple-500" />)}
        </div>
      </div>
    </div>
  );
}