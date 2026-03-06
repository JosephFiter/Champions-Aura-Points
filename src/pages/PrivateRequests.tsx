import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { PlusCircle, X, Users, MessageSquare } from "lucide-react";

interface Request {
  id: string;
  title: string;
  description: string;
  reward: number;
  requesterId: string;
  requesterName: string;
  targetUserId: string;
  targetUserName: string;
  status: 'open' | 'accepted' | 'rejected' | 'renegotiating' | 'completed';
  createdAt: string;
  acceptedBy?: string;
  counterOffer?: number;
}

export function PrivateRequests() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState<{id: string, name: string}[]>([]);

  // Selected request for details modal
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [renegotiateMode, setRenegotiateMode] = useState(false);
  const [counterOfferAmount, setCounterOfferAmount] = useState<number>(1);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState<number>(1);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      // Simplify query: fetch all private requests and filter/sort in JS to avoid index requirement
      const q = query(
        collection(db, "requests"),
        where("type", "==", "private")
      );
      const querySnapshot = await getDocs(q);

      const reqs: Request[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.targetUserId === user.uid || data.requesterId === user.uid) {
           reqs.push({ id: doc.id, ...data } as Request);
        }
      });

      reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRequests(reqs);

      // Fetch all users for the dropdown
      const usersSnap = await getDocs(collection(db, "users"));
      const usersArr: {id: string, name: string}[] = [];
      usersSnap.forEach(doc => {
        if (doc.id !== user.uid && doc.data().championName) {
          usersArr.push({ id: doc.id, name: doc.data().championName });
        }
      });
      setUsersList(usersArr);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !targetUserId) return;
    if (Number(userProfile.cap) < reward) {
      setError("No tienes suficientes CAP para esta recompensa.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const targetUser = usersList.find(u => u.id === targetUserId);

    try {
      await addDoc(collection(db, "requests"), {
        type: "private",
        title,
        description,
        reward,
        requesterId: user.uid,
        requesterName: userProfile.championName,
        targetUserId: targetUserId,
        targetUserName: targetUser?.name || "Desconocido",
        status: "open",
        createdAt: new Date().toISOString()
      });

      // Deduct CAP from user immediately upon requesting
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
      setTargetUserId("");
      fetchData();
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

  const handleAcceptRequest = async (reqId: string, finalReward: number) => {
    if (!user || !userProfile) return;
    try {
      const reqRef = doc(db, "requests", reqId);
      await updateDoc(reqRef, {
        status: "accepted",
        acceptedBy: user.uid,
        acceptedByName: userProfile.championName,
        reward: finalReward // In case it was renegotiated
      });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        requestsAccepted: increment(1),
        cap: increment(finalReward)
      });

      await refreshProfile();
      setSelectedRequest(null);
      fetchData();
    } catch (err) {
      console.error("Error accepting request:", err);
      alert("Error al aceptar el pedido.");
    }
  };

  const handleRejectRequest = async (request: Request) => {
    try {
      const reqRef = doc(db, "requests", request.id);
      await updateDoc(reqRef, { status: "rejected" });

      // Refund the original requester
      const requesterRef = doc(db, "users", request.requesterId);
      await updateDoc(requesterRef, {
        cap: increment(request.reward)
      });

      setSelectedRequest(null);
      fetchData();
    } catch (err) {
      console.error("Error rejecting request:", err);
    }
  };

  const handleRenegotiate = async (request: Request) => {
    if (counterOfferAmount <= request.reward) {
      alert("La contraoferta debe ser mayor a la recompensa original.");
      return;
    }

    try {
      const reqRef = doc(db, "requests", request.id);
      await updateDoc(reqRef, {
        status: "renegotiating",
        counterOffer: counterOfferAmount
      });
      setSelectedRequest(null);
      setRenegotiateMode(false);
      fetchData();
    } catch (err) {
      console.error("Error renegotiating request:", err);
    }
  };

  const handleAcceptCounterOffer = async (request: Request) => {
    if (!user || !userProfile) return;
    const extraCapNeeded = (request.counterOffer || 0) - request.reward;
    if (Number(userProfile.cap) < extraCapNeeded) {
      alert("No tienes suficientes CAP para aceptar la contraoferta.");
      return;
    }

    try {
      // Deduct the extra CAP from the original requester
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        cap: increment(-extraCapNeeded)
      });

      const reqRef = doc(db, "requests", request.id);
      await updateDoc(reqRef, {
        status: "open", // goes back to open for the target to just "accept"
        reward: request.counterOffer,
        counterOffer: 0
      });

      await refreshProfile();
      fetchData();
    } catch (err) {
      console.error("Error accepting counteroffer:", err);
    }
  };

  const handleRejectCounterOffer = async (request: Request) => {
    try {
      const reqRef = doc(db, "requests", request.id);
      await updateDoc(reqRef, {
        status: "open", // stays open with original reward, or reject completely?
        counterOffer: 0 // Let's just remove the counter offer
      });
      fetchData();
    } catch (err) {
      console.error("Error rejecting counteroffer:", err);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos Privados</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Crear Privado
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Pedido Privado</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Para quién (Champion)</label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="" disabled>Selecciona un Champion</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Título</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Ej: Ayudame a mudarme"
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
                  {submitting ? "Enviando..." : "Enviar Pedido Privado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">{selectedRequest.title}</h2>
              <button onClick={() => { setSelectedRequest(null); setRenegotiateMode(false); }} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">De</p>
                <p className="mt-1 text-sm text-gray-900">{selectedRequest.requesterName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Descripción</p>
                <p className="mt-1 text-sm text-gray-900">{selectedRequest.description}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Recompensa Original</p>
                <p className="mt-1 text-lg font-bold text-green-600">{selectedRequest.reward} CAP</p>
              </div>

              {renegotiateMode ? (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700">Tu Contraoferta (CAP)</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="number"
                      min={Number(selectedRequest.reward) + 1}
                      value={counterOfferAmount}
                      onChange={(e) => setCounterOfferAmount(Number(e.target.value))}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    <button
                      onClick={() => { if (selectedRequest) handleRenegotiate(selectedRequest); }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Enviar
                    </button>
                  </div>
                  <button
                    onClick={() => setRenegotiateMode(false)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="mt-6 flex flex-col space-y-3">
                  <button
                    onClick={() => handleAcceptRequest(selectedRequest.id, selectedRequest.reward)}
                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    Aceptar Pedido
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => { setRenegotiateMode(true); setCounterOfferAmount(selectedRequest.reward + 1); }}
                      className="flex-1 inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Renegociar
                    </button>
                    <button
                      onClick={() => handleRejectRequest(selectedRequest)}
                      className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {loading ? (
        <div className="text-center py-10">Cargando...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow border border-gray-200">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pedidos privados</h3>
          <p className="mt-1 text-sm text-gray-500">Aquí verás los pedidos que te hagan directamente.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((request: Request) => (
            <div key={request.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 flex flex-col">
              <div className="p-5 flex-1 cursor-pointer" onClick={() => {
                if (request.targetUserId === user?.uid && request.status === 'open') {
                  setSelectedRequest(request);
                }
              }}>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {request.status === 'open' ? 'Pendiente' :
                     request.status === 'renegotiating' ? 'Renegociando' :
                     request.status === 'accepted' ? 'Aceptado' : 'Rechazado'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">{request.title}</h3>

                {request.requesterId === user?.uid ? (
                  <p className="mt-2 text-xs font-medium text-gray-900">
                    Enviado a: <span className="text-blue-600">{request.targetUserName}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-gray-900">
                    De: <span className="text-blue-600">{request.requesterName}</span>
                  </p>
                )}

                <div className="mt-4 flex items-center text-sm text-gray-500">
                   <span className="font-bold text-green-600">+{request.reward} CAP</span>
                   {request.counterOffer ? (
                     <span className="ml-2 text-yellow-600 font-bold">(Contraoferta: {request.counterOffer})</span>
                   ) : null}
                </div>
              </div>

              {/* Actions for original requester when target is renegotiating */}
              {request.requesterId === user?.uid && request.status === 'renegotiating' && (
                <div className="bg-yellow-50 px-5 py-3 border-t border-yellow-200">
                  <p className="text-xs text-yellow-800 mb-2 font-medium">
                    {request.targetUserName} pide {request.counterOffer} CAP
                  </p>
                  <div className="flex space-x-2">
                    <button onClick={() => handleAcceptCounterOffer(request)} className="flex-1 bg-green-600 text-white text-xs py-1 rounded hover:bg-green-700">Aceptar</button>
                    <button onClick={() => handleRejectCounterOffer(request)} className="flex-1 bg-red-600 text-white text-xs py-1 rounded hover:bg-red-700">Rechazar</button>
                  </div>
                </div>
              )}

              {/* Click instruction for targets */}
              {request.targetUserId === user?.uid && request.status === 'open' && (
                <div className="bg-gray-50 px-5 py-2 border-t border-gray-200 text-center">
                  <span className="text-xs text-gray-500 flex items-center justify-center">
                    <MessageSquare className="h-3 w-3 mr-1" /> Click para ver/responder
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}