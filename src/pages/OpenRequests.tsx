import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { PlusCircle, Clock, CheckCircle, X } from "lucide-react";

interface Request {
  id: string;
  title: string;
  description: string;
  reward: number;
  requesterId: string;
  requesterName: string;
  status: 'open' | 'accepted' | 'completed';
  createdAt: string;
  acceptedBy?: string;
}

export function OpenRequests() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      // Simplify query to avoid requiring composite indexes on Firestore
      const q = query(
        collection(db, "requests"),
        where("type", "==", "open")
      );
      const querySnapshot = await getDocs(q);
      const reqs: Request[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "open") {
          reqs.push({ id: doc.id, ...data } as Request);
        }
      });
      // Sort in JS
      reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRequests(reqs);
    } catch (err) {
      console.error("Error fetching requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    if (Number(userProfile.cap) < reward) {
      setError("No tienes suficientes CAP para esta recompensa.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create request document
      await addDoc(collection(db, "requests"), {
        type: "open",
        title,
        description,
        reward,
        requesterId: user.uid,
        requesterName: userProfile.championName,
        status: "open",
        createdAt: new Date().toISOString()
      });

      // Deduct CAP from user
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        cap: increment(-reward),
        requestsMade: increment(1)
      });

      await refreshProfile();
      setShowForm(false);
      setTitle("");
      setDescription("");
      setReward(1);
      fetchRequests();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Error al crear el pedido.");
      } else {
        setError("Error al crear el pedido.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptRequest = async (request: Request) => {
    if (!user || !userProfile) return;
    if (request.requesterId === user.uid) {
      alert("No puedes aceptar tu propio pedido.");
      return;
    }

    try {
      const reqRef = doc(db, "requests", request.id);
      await updateDoc(reqRef, {
        status: "accepted",
        acceptedBy: user.uid,
        acceptedByName: userProfile.championName
      });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        requestsAccepted: increment(1)
      });

      // In a real app we might want a 'completed' flow before rewarding,
      // but to keep it simple as requested, let's reward upon acceptance or completion.
      // Assuming acceptance gives the reward here to simple use case:
      await updateDoc(userRef, {
        cap: increment(request.reward)
      });

      await refreshProfile();
      fetchRequests();
    } catch (err) {
      console.error("Error accepting request:", err);
      alert("Error al aceptar el pedido.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Mandados Abiertos</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Crear Pedido
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Pedido</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Título</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Ej: Ir a comprar facturas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Descripción / Detalles</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  rows={3}
                  placeholder="Detalla qué necesitas..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Recompensa (CAP)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Number(userProfile?.cap) || 0}
                  value={reward}
                  onChange={(e) => setReward(Number(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Tienes {Number(userProfile?.cap) || 0} CAP disponibles.</p>
              </div>
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Creando..." : "Publicar Pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">Cargando...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow border border-gray-200">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay mandados activos</h3>
          <p className="mt-1 text-sm text-gray-500">Sé el primero en crear uno nuevo.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((request: Request) => (
            <div key={request.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    +{request.reward} CAP
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">{request.title}</h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-3">{request.description}</p>
                <p className="mt-4 text-xs font-medium text-gray-900">
                  Pedido por: {request.requesterName}
                </p>
              </div>
              <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
                {request.requesterId === user?.uid ? (
                  <span className="text-sm text-gray-500 italic">Es tu pedido</span>
                ) : (
                  <button
                    onClick={() => handleAcceptRequest(request)}
                    className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aceptar Mandado
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}