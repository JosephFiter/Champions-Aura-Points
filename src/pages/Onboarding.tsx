import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const AVAILABLE_CHAMPIONS = [
  "Líder Supremo",
  "El Sabio",
  "El Bromista",
  "El Estratega",
  "El Valiente",
  "El Negociador",
  "El Veloz",
  "El Fuerte",
  "El Protector",
  "El Misterioso"
];

export function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const [availableChampions, setAvailableChampions] = useState<string[]>([]);
  const [selectedChampion, setSelectedChampion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTakenChampions = async () => {
      try {
        const configDoc = await getDoc(doc(db, "system", "champions"));
        let takenChampions: string[] = [];
        if (configDoc.exists()) {
          takenChampions = configDoc.data().taken || [];
        } else {
          // Initialize system config if it doesn't exist
          await setDoc(doc(db, "system", "champions"), { taken: [] });
        }

        const available = AVAILABLE_CHAMPIONS.filter(c => !takenChampions.includes(c));
        setAvailableChampions(available);
      } catch (err) {
        console.error("Error fetching champions", err);
        setError("Error al cargar la lista de Champions.");
      } finally {
        setLoading(false);
      }
    };

    fetchTakenChampions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChampion || !user) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Update user profile
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        championName: selectedChampion,
        cap: 10,
        requestsMade: 0,
        requestsAccepted: 0,
        onboardedAt: new Date().toISOString()
      });

      // 2. Add to taken champions list
      const configDoc = await getDoc(doc(db, "system", "champions"));
      const taken = configDoc.exists() ? configDoc.data().taken || [] : [];
      await setDoc(doc(db, "system", "champions"), {
        taken: [...taken, selectedChampion]
      });

      // 3. Refresh Auth Context
      await refreshProfile();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Error al completar el onboarding.");
      } else {
        setError("Error al completar el onboarding.");
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Bienvenido, Champion
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Antes de empezar, debes elegir quién eres.
          Al elegir, recibirás 10 CAP (Champions Aura Points).
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          {availableChampions.length === 0 ? (
            <div className="text-center text-gray-600 py-4">
              No quedan Champions disponibles.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona tu nombre
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-md">
                  {availableChampions.map((champion) => (
                    <label key={champion} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="radio"
                        name="champion"
                        value={champion}
                        checked={selectedChampion === champion}
                        onChange={(e) => setSelectedChampion(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-gray-900 font-medium">{champion}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedChampion || submitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? "Asignando..." : "Confirmar e Iniciar"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
