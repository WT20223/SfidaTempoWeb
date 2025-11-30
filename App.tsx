import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  Sun, Moon, ShowerHead, Star, AlertTriangle, 
  Skull, ShoppingBag, Gamepad2, UtensilsCrossed, 
  History, RotateCcw, ShieldAlert, CheckCircle2, 
  Trophy, Sparkles, Frown, Trash2, WifiOff,
  Settings, Plus, X, Pencil, Users, Heart,
  Zap, BookOpen, Music, Tv, Smartphone, Car, Bed, Clock,
  Home, Smile, Ghost, Crown, Rocket, Share2, Link as LinkIcon, Copy
} from 'lucide-react';

// --- Icon Mapping ---
// Mappa stringhe -> componenti per salvare le icone nel DB
const ICON_MAP: Record<string, React.ElementType> = {
  Sun, Moon, ShowerHead, Star, AlertTriangle, 
  Skull, ShoppingBag, Gamepad2, UtensilsCrossed, 
  History, RotateCcw, ShieldAlert, CheckCircle2, 
  Trophy, Sparkles, Frown, Trash2, WifiOff,
  Users, Heart, Zap, BookOpen, Music, Tv, 
  Smartphone, Car, Bed, Clock,
  Home, Smile, Ghost, Crown, Rocket
};

// --- Global Types & Interfaces ---

interface HistoryItem {
  id: string;
  action: string;
  points: number;
  timestamp: any;
  type: 'gain' | 'loss' | 'spend';
}

interface ActionItem {
  id: string;
  label: string;
  points: number;
  iconName: string;
  variant: 'neutral' | 'success' | 'danger' | 'warning' | 'special';
  size: 'normal' | 'large';
}

interface AppData {
  familyName: string;
  familyIcon: string;
  xp: number;
  history: HistoryItem[];
  gainActions: ActionItem[];
  lossActions: ActionItem[];
  shopItems: ActionItem[];
}

interface LevelInfo {
  name: string;
  color: string;
  bgGradient: string;
  icon: React.ReactNode;
  textColor: string;
}

// --- Default Data (Initial Seed) ---

const DEFAULT_GAIN_ACTIONS: ActionItem[] = [
  { id: 'g1', label: "Pronta Mattino", points: 5, iconName: 'Sun', variant: 'success', size: 'large' },
  { id: 'g2', label: "Pronta Sera", points: 5, iconName: 'Moon', variant: 'success', size: 'large' },
  { id: 'g3', label: "Doccia Veloce", points: 3, iconName: 'ShowerHead', variant: 'neutral', size: 'normal' },
  { id: 'g4', label: "Voto 8", points: 3, iconName: 'Star', variant: 'neutral', size: 'normal' },
  { id: 'g5', label: "Voto 9", points: 5, iconName: 'Star', variant: 'special', size: 'normal' },
  { id: 'g6', label: "Voto 10", points: 8, iconName: 'Trophy', variant: 'special', size: 'normal' },
];

const DEFAULT_LOSS_ACTIONS: ActionItem[] = [
  { id: 'l1', label: "Ripetere", points: -2, iconName: 'RotateCcw', variant: 'danger', size: 'normal' },
  { id: 'l2', label: "Sgarbata", points: -2, iconName: 'Frown', variant: 'danger', size: 'normal' },
  { id: 'l3', label: "Disordine", points: -5, iconName: 'Trash2', variant: 'danger', size: 'normal' },
  { id: 'l4', label: "BUGIA", points: -50, iconName: 'Skull', variant: 'danger', size: 'normal' },
];

const DEFAULT_SHOP_ITEMS: ActionItem[] = [
  { id: 's1', label: "20 min Social/TV", points: -20, iconName: 'Gamepad2', variant: 'neutral', size: 'normal' },
  { id: 's2', label: "Salta Compito", points: -15, iconName: 'Sparkles', variant: 'neutral', size: 'normal' },
  { id: 's3', label: "Roblox 25 min", points: -25, iconName: 'Gamepad2', variant: 'neutral', size: 'normal' },
  { id: 's4', label: "Cena Sabato", points: -50, iconName: 'UtensilsCrossed', variant: 'special', size: 'normal' },
];

const INITIAL_DATA: AppData = {
  familyName: "La Nostra Famiglia",
  familyIcon: "Home",
  xp: 0,
  history: [],
  gainActions: DEFAULT_GAIN_ACTIONS,
  lossActions: DEFAULT_LOSS_ACTIONS,
  shopItems: DEFAULT_SHOP_ITEMS
};

// --- Firebase Initialization Helper ---

const getFirebaseConfig = () => {
  // @ts-ignore
  if (typeof window !== 'undefined' && window.firebaseConfig) return window.firebaseConfig;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    const env = import.meta.env;
    const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || env.REACT_APP_FIREBASE_API_KEY;
    if (apiKey) {
      return {
        apiKey: apiKey,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || env.REACT_APP_FIREBASE_APP_ID,
      };
    }
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      const p = process.env;
      const apiKey = p.REACT_APP_FIREBASE_API_KEY || p.FIREBASE_API_KEY;
      if (apiKey) {
        return {
          apiKey: apiKey,
          authDomain: p.REACT_APP_FIREBASE_AUTH_DOMAIN || p.FIREBASE_AUTH_DOMAIN,
          projectId: p.REACT_APP_FIREBASE_PROJECT_ID || p.FIREBASE_PROJECT_ID,
          storageBucket: p.REACT_APP_FIREBASE_STORAGE_BUCKET || p.FIREBASE_STORAGE_BUCKET,
          messagingSenderId: p.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || p.FIREBASE_MESSAGING_SENDER_ID,
          appId: p.REACT_APP_FIREBASE_APP_ID || p.FIREBASE_APP_ID,
        };
      }
    }
  } catch (e) {}
  return null;
};

// --- Helpers ---

const getAppIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('appId') || 'default_family_app';
};

const getDocPath = () => {
  const appId = getAppIdFromUrl();
  return `artifacts/${appId}/public/data/family_app/shared_data`;
};

const getLevelInfo = (xp: number): LevelInfo => {
  if (xp < 0) return { 
    name: "In Debito", 
    color: "bg-red-500", 
    bgGradient: "from-red-600 to-red-800",
    icon: <Frown className="w-8 h-8 text-white" />,
    textColor: "text-red-600"
  };
  if (xp >= 200) return { 
    name: "Leggendario", 
    color: "bg-yellow-500", 
    bgGradient: "from-yellow-400 to-amber-600",
    icon: <Trophy className="w-8 h-8 text-white" />,
    textColor: "text-amber-600"
  };
  if (xp >= 100) return { 
    name: "Super Pro", 
    color: "bg-green-500", 
    bgGradient: "from-green-500 to-emerald-700",
    icon: <Sparkles className="w-8 h-8 text-white" />,
    textColor: "text-emerald-600"
  };
  if (xp >= 50) return { 
    name: "Pro", 
    color: "bg-blue-500", 
    bgGradient: "from-blue-500 to-indigo-700",
    icon: <CheckCircle2 className="w-8 h-8 text-white" />,
    textColor: "text-blue-600"
  };
  return { 
    name: "Novellino", 
    color: "bg-gray-500", 
    bgGradient: "from-gray-400 to-gray-600",
    icon: <Star className="w-8 h-8 text-white" />,
    textColor: "text-gray-600"
  };
};

// --- Helper Components ---

// Animated Counter Component
const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number;
    const duration = 800; // ms
    const startValue = displayValue;
    const delta = value - startValue;

    if (delta === 0) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (delta * ease));
      setDisplayValue(current);
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{displayValue}</span>;
};

interface ActionButtonProps {
  item: ActionItem;
  onClick: () => void;
  disabled?: boolean;
  editMode: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ item, onClick, disabled, editMode }) => {
  const Icon = ICON_MAP[item.iconName] || Star;
  
  const baseStyles = "relative flex flex-col items-center justify-center rounded-2xl transition-all duration-200 border-b-4 select-none touch-manipulation";
  const activeStyles = disabled 
    ? "opacity-40 grayscale cursor-not-allowed border-gray-200 bg-gray-50" 
    : "active:border-b-0 active:translate-y-1 shadow-sm hover:shadow-md active:shadow-none";

  const variants = {
    neutral: "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
    success: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
    danger: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    warning: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
    special: "bg-gradient-to-br from-amber-100 to-yellow-50 border-amber-300 text-amber-800"
  };

  const sizes = {
    normal: "p-3 h-28",
    large: "p-4 h-36"
  };

  return (
    <button 
      onClick={onClick}
      disabled={!editMode && disabled}
      className={`
        ${baseStyles} 
        ${variants[item.variant]} 
        ${sizes[item.size]}
        ${activeStyles}
        ${editMode ? 'animate-pulse ring-2 ring-blue-400 border-blue-400' : ''}
      `}
    >
      {editMode && <div className="absolute top-1 right-1 bg-blue-500 text-white p-1 rounded-full shadow-md z-10"><Pencil size={10} /></div>}
      <div className={`mb-2 rounded-full p-2 ${disabled ? 'bg-gray-200' : 'bg-white/60'}`}>
        <Icon className={item.size === 'large' ? "w-8 h-8" : "w-6 h-6"} />
      </div>
      <span className="font-bold text-center leading-tight text-sm mb-1 line-clamp-2">{item.label}</span>
      <span className={`font-black text-xs px-2 py-0.5 rounded-full ${item.points < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
        {item.points > 0 ? '+' : ''}{item.points} XP
      </span>
    </button>
  );
};

// --- Main App Component ---

export default function App() {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentAppId, setCurrentAppId] = useState(getAppIdFromUrl());

  // Modals state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    action?: () => void;
    isDanger?: boolean;
    confirmText?: string;
    isEditor?: boolean;
    editItem?: ActionItem | null;
    editType?: 'gain' | 'loss' | 'shop' | 'family';
  }>({
    isOpen: false,
    title: "",
  });
  
  const fbRef = useRef<{db: any, auth: any} | null>(null);
  const docPath = useMemo(() => getDocPath(), []);
  const levelInfo = getLevelInfo(data.xp);

  // --- Initialization ---
  
  useEffect(() => {
    const init = async () => {
      try {
        if (!fbRef.current) {
          const config = getFirebaseConfig();
          if (!config || !config.apiKey) {
            setIsDemoMode(true);
            setLoading(false);
            return;
          }
          const app = getApps().length === 0 ? initializeApp(config) : getApp();
          fbRef.current = {
            db: getFirestore(app),
            auth: getAuth(app)
          };
        }

        const { db, auth } = fbRef.current;
        
        // @ts-ignore
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          // @ts-ignore
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        const docRef = doc(db, docPath);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          await setDoc(docRef, INITIAL_DATA);
        }

        const unsubscribe = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            const remoteData = snap.data();
            setData(prev => ({ ...prev, ...remoteData }));
          }
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        console.error("Init error", err);
        setIsDemoMode(true);
        setLoading(false);
      }
    };
    init();
  }, [docPath]);

  // --- Persistence Handlers ---

  const saveToDb = async (newData: Partial<AppData>) => {
    if (isDemoMode || !fbRef.current) return;
    try {
      await updateDoc(doc(fbRef.current.db, docPath), newData);
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const handleTransaction = useCallback(async (amount: number, label: string, type: 'gain' | 'loss' | 'spend') => {
    const newHistoryItem: HistoryItem = {
      id: crypto.randomUUID(),
      action: label,
      points: amount,
      timestamp: isDemoMode ? { seconds: Date.now() / 1000 } : Timestamp.now(),
      type
    };

    const newData = {
      xp: (data.xp || 0) + amount,
      history: [newHistoryItem, ...data.history].slice(0, 50)
    };

    // Optimistic Update
    setData(prev => ({ ...prev, ...newData }));
    
    // DB Update
    if (!isDemoMode && fbRef.current) {
        await updateDoc(doc(fbRef.current.db, docPath), {
            xp: newData.xp,
            history: arrayUnion(newHistoryItem)
        });
    }
  }, [data.xp, data.history, docPath, isDemoMode]);

  const handleUpdateItem = async (item: ActionItem, type: 'gain' | 'loss' | 'shop') => {
    let listKey: keyof AppData;
    if (type === 'gain') listKey = 'gainActions';
    else if (type === 'loss') listKey = 'lossActions';
    else listKey = 'shopItems';

    const currentList = data[listKey] as ActionItem[];
    const idx = currentList.findIndex(i => i.id === item.id);
    
    let newList;
    if (idx >= 0) {
      newList = [...currentList];
      newList[idx] = item;
    } else {
      newList = [...currentList, item];
    }

    setData(prev => ({ ...prev, [listKey]: newList }));
    await saveToDb({ [listKey]: newList });
    setModalConfig({ isOpen: false, title: "" });
  };

  const handleDeleteItem = async (id: string, type: 'gain' | 'loss' | 'shop') => {
    let listKey: keyof AppData;
    if (type === 'gain') listKey = 'gainActions';
    else if (type === 'loss') listKey = 'lossActions';
    else listKey = 'shopItems';

    const newList = (data[listKey] as ActionItem[]).filter(i => i.id !== id);
    setData(prev => ({ ...prev, [listKey]: newList }));
    await saveToDb({ [listKey]: newList });
  };

  const handleFamilyUpdate = async (newName: string, newIcon: string) => {
    setData(prev => ({ ...prev, familyName: newName, familyIcon: newIcon }));
    await saveToDb({ familyName: newName, familyIcon: newIcon });
    setModalConfig({ isOpen: false, title: "" });
  };

  // --- UI Action Handlers ---

  const triggerAction = (item: ActionItem, type: 'gain' | 'loss' | 'spend') => {
    if (editMode) {
      setModalConfig({
        isOpen: true,
        title: "Modifica Pulsante",
        isEditor: true,
        editItem: item,
        editType: type === 'spend' ? 'shop' : (type === 'gain' ? 'gain' : 'loss')
      });
      return;
    }

    const isBigPenalty = item.points <= -50 || item.label.toUpperCase().includes('BUGIA');
    
    if (isBigPenalty) {
      setModalConfig({
        isOpen: true,
        title: item.label,
        message: `Attenzione! Stai per registrare "${item.label}" con una penalità di ${item.points} XP. Sei sicuro?`,
        confirmText: "Conferma Penalità",
        isDanger: true,
        action: () => {
          handleTransaction(item.points, item.label, type);
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      handleTransaction(item.points, item.label, type);
    }
  };

  // --- Sub-Components ---

  const EditorModal = () => {
    const isFamilyEditor = modalConfig.editType === 'family';

    if (isFamilyEditor) {
      const [name, setName] = useState(data.familyName);
      const [icon, setIcon] = useState(data.familyIcon || 'Home');
      const [syncId, setSyncId] = useState(currentAppId);

      const handleCopyLink = () => {
        const url = `${window.location.origin}${window.location.pathname}?appId=${syncId}`;
        navigator.clipboard.writeText(url);
        alert("Link copiato! Invialo agli altri membri della famiglia.");
      };

      const handleSyncChange = () => {
        if (syncId !== currentAppId) {
          if (window.confirm("Cambiare codice famiglia ricaricherà la pagina. Confermi?")) {
             window.location.href = `${window.location.pathname}?appId=${syncId}`;
          }
        } else {
          handleFamilyUpdate(name, icon);
        }
      };

      return (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
             <div className="flex items-center gap-2 mb-2">
                <Share2 size={18} className="text-blue-600" />
                <label className="text-sm font-bold text-blue-800">Sincronizzazione Famiglia</label>
             </div>
             <p className="text-xs text-blue-600 mb-3 leading-tight">
               Usa questo codice su tutti i telefoni per vedere gli stessi punti.
             </p>
             <div className="flex gap-2">
               <input 
                  value={syncId}
                  onChange={e => setSyncId(e.target.value.replace(/\s/g, ''))}
                  className="flex-1 p-2 text-sm rounded-lg border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono tracking-wide"
                  placeholder="CODICE-FAMIGLIA"
               />
               <button onClick={handleCopyLink} className="bg-white p-2 rounded-lg border border-blue-200 text-blue-600 shadow-sm">
                 <LinkIcon size={18} />
               </button>
             </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nome della Famiglia</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Icona Widget</label>
            <div className="grid grid-cols-6 gap-2 h-32 overflow-y-auto p-2 border rounded-xl bg-gray-50">
              {Object.keys(ICON_MAP).map(iconName => {
                const Icon = ICON_MAP[iconName];
                return (
                  <button
                    key={iconName}
                    onClick={() => setIcon(iconName)}
                    className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                      icon === iconName ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <Icon size={20} />
                  </button>
                );
              })}
            </div>
          </div>
          <button 
             onClick={handleSyncChange}
             className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 mt-2"
           >
             Salva Impostazioni
           </button>
        </div>
      );
    }

    // Standard Action Editor
    const [localItem, setLocalItem] = useState<ActionItem>(
      modalConfig.editItem || {
        id: crypto.randomUUID(),
        label: "",
        points: 0,
        iconName: 'Star',
        variant: 'neutral',
        size: 'normal'
      }
    );

    const variants = ['neutral', 'success', 'danger', 'warning', 'special'];

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Nome Azione</label>
          <input 
            value={localItem.label}
            onChange={e => setLocalItem({...localItem, label: e.target.value})}
            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Es. Lavare i denti"
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Punti (Negativi per costi/penalità)</label>
          <input 
            type="number"
            value={localItem.points}
            onChange={e => setLocalItem({...localItem, points: parseInt(e.target.value) || 0})}
            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Colore & Stile</label>
          <div className="flex gap-2 flex-wrap">
            {variants.map(v => (
              <button 
                key={v}
                onClick={() => setLocalItem({...localItem, variant: v as any})}
                className={`px-3 py-1 rounded-full text-xs font-bold capitalize border-2 ${
                  localItem.variant === v ? 'border-blue-600 bg-blue-50' : 'border-transparent bg-gray-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Dimensione</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setLocalItem({...localItem, size: 'normal'})}
              className={`flex-1 py-2 rounded-lg text-sm font-bold ${localItem.size === 'normal' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
            >
              Normale
            </button>
            <button 
              onClick={() => setLocalItem({...localItem, size: 'large'})}
              className={`flex-1 py-2 rounded-lg text-sm font-bold ${localItem.size === 'large' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
            >
              Grande
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Icona</label>
          <div className="grid grid-cols-6 gap-2 h-32 overflow-y-auto p-2 border rounded-xl bg-gray-50">
            {Object.keys(ICON_MAP).map(iconName => {
              const Icon = ICON_MAP[iconName];
              return (
                <button
                  key={iconName}
                  onClick={() => setLocalItem({...localItem, iconName})}
                  className={`p-2 rounded-lg flex items-center justify-center ${
                    localItem.iconName === iconName ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
           {modalConfig.editItem && (
            <button
              onClick={() => {
                if(window.confirm("Eliminare questa azione?")) {
                  handleDeleteItem(localItem.id, modalConfig.editType as any);
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                }
              }}
              className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200"
            >
              <Trash2 size={20} />
            </button>
           )}
           <button 
             onClick={() => handleUpdateItem(localItem, modalConfig.editType as any)}
             className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700"
           >
             Salva Modifiche
           </button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  const FamilyIconComponent = ICON_MAP[data.familyIcon || 'Home'] || Home;

  return (
    <div className="min-h-screen pb-12 relative font-sans" style={{ zoom: '1.15' }}>
      
      {/* Demo Banner */}
      {isDemoMode && (
        <div className="bg-amber-100 text-amber-800 text-xs font-bold text-center py-1 flex justify-center gap-2">
          <WifiOff size={14} /> DEMO - Dati non salvati
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 transition-all duration-500 bg-gradient-to-r ${levelInfo.bgGradient} text-white shadow-lg rounded-b-3xl pt-safe-top`}>
        <div className="px-5 py-3 flex items-center justify-between max-w-2xl mx-auto">
          {/* Family Widget */}
          <div 
            onClick={() => editMode && setModalConfig({ isOpen: true, title: "Impostazioni Famiglia", isEditor: true, editType: 'family', editItem: null })}
            className={`flex items-center gap-3 transition-all ${editMode ? 'cursor-pointer hover:scale-105 active:scale-95 bg-white/10 p-2 rounded-xl border border-white/30 border-dashed' : ''}`}
          >
             <div className="relative p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm shadow-inner">
                <FamilyIconComponent className="w-7 h-7 text-white" />
                {editMode && <div className="absolute -top-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full"><Pencil size={10} /></div>}
             </div>
             <div>
               <div className="flex items-center gap-2">
                   <div className="text-xs font-medium uppercase tracking-wider opacity-80 truncate max-w-[120px]">{data.familyName || "Famiglia"}</div>
               </div>
               <div className="flex items-center gap-2 font-bold text-xl leading-none mt-1">
                 {levelInfo.icon}
                 <span className="drop-shadow-sm">{levelInfo.name}</span>
               </div>
             </div>
          </div>
          
          <div className="text-right">
             <div className="flex items-center justify-end gap-2">
                <button 
                  onClick={() => setEditMode(!editMode)} 
                  className={`p-2 rounded-full transition-colors ${editMode ? 'bg-white text-blue-600 shadow-lg' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  <Settings size={18} />
                </button>
                <div className="text-xs font-medium uppercase tracking-wider opacity-80">Totale XP</div>
             </div>
             <div className="text-5xl font-black tracking-tighter drop-shadow-md">
               <AnimatedNumber value={data.xp} />
             </div>
          </div>
        </div>
        {editMode && (
          <div className="bg-yellow-300 text-yellow-900 text-center text-xs font-bold py-1.5 animate-pulse">
            MODALITÀ MODIFICA ATTIVA
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        
        {/* SECTION: GAIN */}
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <Sparkles className="text-blue-500 w-5 h-5" />
              <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">Guadagna Punti</h2>
            </div>
            {editMode && (
              <button 
                onClick={() => setModalConfig({ isOpen: true, title: "Nuova Azione", isEditor: true, editType: 'gain', editItem: null })}
                className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
             {data.gainActions.filter(i => i.size === 'large').map(item => (
                <ActionButton key={item.id} item={item} onClick={() => triggerAction(item, 'gain')} editMode={editMode} />
             ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {data.gainActions.filter(i => i.size !== 'large').map(item => (
                <ActionButton key={item.id} item={item} onClick={() => triggerAction(item, 'gain')} editMode={editMode} />
             ))}
          </div>
        </section>

        {/* SECTION: LOSS */}
        <section className="bg-red-50/50 p-4 rounded-3xl border border-red-100">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-red-500 w-5 h-5" />
              <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">Penalità</h2>
            </div>
            {editMode && (
              <button 
                onClick={() => setModalConfig({ isOpen: true, title: "Nuova Penalità", isEditor: true, editType: 'loss', editItem: null })}
                className="bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700 transition-colors"
              >
                <Plus size={20} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.lossActions.map(item => (
                <ActionButton key={item.id} item={item} onClick={() => triggerAction(item, 'loss')} editMode={editMode} />
             ))}
          </div>
        </section>

        {/* SECTION: SHOP */}
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="text-purple-500 w-5 h-5" />
              <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">Negozio Premi</h2>
            </div>
            {editMode ? (
              <button 
                onClick={() => setModalConfig({ isOpen: true, title: "Nuovo Premio", isEditor: true, editType: 'shop', editItem: null })}
                className="bg-purple-600 text-white p-1.5 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
              >
                <Plus size={20} />
              </button>
            ) : (
              <div className="text-xs font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                {data.xp} XP Disponibili
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             {data.shopItems.map(item => (
                <ActionButton 
                  key={item.id} 
                  item={item} 
                  onClick={() => triggerAction(item, 'spend')} 
                  disabled={data.xp < Math.abs(item.points)}
                  editMode={editMode}
                />
             ))}
          </div>
        </section>

        {/* HISTORY */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
               <History className="text-gray-400 w-5 h-5" />
               <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">Storico</h2>
             </div>
             <button 
              onClick={() => {
                setModalConfig({
                  isOpen: true,
                  title: "Reset Totale",
                  message: "Attenzione: questo cancellerà tutti i punti, lo storico e resetterà le impostazioni di default.",
                  isDanger: true,
                  confirmText: "RESETTA TUTTO",
                  action: async () => {
                     // Reset to default but keep app ID logic
                     setData(INITIAL_DATA);
                     setModalConfig({isOpen: false, title: ""});
                     if(!isDemoMode && fbRef.current) {
                        await setDoc(doc(fbRef.current.db, docPath), INITIAL_DATA);
                     }
                  }
                });
              }}
              className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-100 transition-colors"
             >
               Reset Totale
             </button>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {[...data.history].sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 text-sm">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700">{item.action}</span>
                    <span className="text-xs text-gray-400">
                      {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleString('it-IT', { 
                        weekday: 'short', hour: '2-digit', minute: '2-digit' 
                      }) : 'Adesso'}
                    </span>
                  </div>
                  <span className={`font-black px-2 py-1 rounded-lg ${
                    item.type === 'gain' ? 'text-green-600 bg-green-100' : 
                    item.type === 'loss' ? 'text-red-600 bg-red-100' : 
                    'text-purple-600 bg-purple-100'
                  }`}>
                    {item.points > 0 ? '+' : ''}{item.points}
                  </span>
                </div>
            ))}
            {data.history.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm italic">
                Nessuna attività recente
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Global Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className={`p-6 text-center shrink-0 ${modalConfig.isDanger ? 'bg-red-50' : 'bg-gray-50'}`}>
              <h3 className="text-2xl font-bold text-gray-800">{modalConfig.title}</h3>
              {modalConfig.message && <p className="text-gray-600 mt-2 text-sm leading-relaxed">{modalConfig.message}</p>}
            </div>
            
            <div className="p-4 overflow-y-auto">
              {modalConfig.isEditor ? (
                 <EditorModal />
              ) : (
                <div className="flex gap-4">
                  <button 
                    onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Annulla
                  </button>
                  <button 
                    onClick={modalConfig.action}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-colors ${
                      modalConfig.isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {modalConfig.confirmText || "Conferma"}
                  </button>
                </div>
              )}
            </div>
            
            {/* Close button for Editor mode if needed extra escape */}
            {modalConfig.isEditor && (
               <button onClick={() => setModalConfig(prev => ({...prev, isOpen: false}))} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                 <X size={24} />
               </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}