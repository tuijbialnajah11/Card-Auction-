import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

interface Card {
  id: string;
  card_name: string;
  tier: number;
  status: 'pending' | 'approved' | 'auctioned' | 'blacklisted';
  bid_amount: number | null;
  buyer: string | null;
  submitted_by: string;
  created_at: string;
  approved_at: string | null;
}

type Page = 'leaderboard' | 'auth' | 'submit' | 'admin';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('leaderboard');
  const [user, setUser] = useState<User | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [cards, setCards] = useState<Card[]>([]);
  const [adminCards, setAdminCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitPageLoading, setSubmitPageLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cardName, setCardName] = useState('');
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [userCard, setUserCard] = useState<Card | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<'pending' | 'approved' | 'blacklisted'>('pending');

  // Admin Approval Modal State
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [approveBid, setApproveBid] = useState('');
  const [approveBuyer, setApproveBuyer] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isDirectAdd, setIsDirectAdd] = useState(false);
  const [directCardName, setDirectCardName] = useState('');
  const [directTier, setDirectTier] = useState('6');

  // Admin check - including the new admin email
  const isAdmin = user?.email === 'tuijbialnajah@gmail.com' || user?.email === 'pintrestk11@gmail.com';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    loadLeaderboard();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserCard();
    } else {
      setUserCard(null);
    }
  }, [user, currentPage]);

  useEffect(() => {
    if (currentPage === 'admin' && isAdmin) {
      loadAdminCards();
    }
  }, [currentPage, isAdmin]);

  const showAlert = (message: string, type: 'success' | 'error' | 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .in('status', ['approved', 'auctioned'])
        .order('bid_amount', { ascending: false });

      if (error) {
        showAlert('Failed to load: ' + error.message, 'error');
      } else {
        setCards(data || []);
      }
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminCards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showAlert('Failed to load requests: ' + error.message, 'error');
      } else {
        setAdminCards(data || []);
      }
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserCard = async () => {
    if (!user) return;
    setSubmitPageLoading(true);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user card:', error);
      } else if (data && data.length > 0) {
        // Find if there's a pending card
        const pendingCard = data.find(c => c.status === 'pending');
        if (pendingCard) {
          setUserCard(pendingCard);
          setCooldownRemaining(null);
          return;
        }

        // If no pending card, check the most recent approved/auctioned card for cooldown
        const lastProcessedCard = data.find(c => c.status !== 'pending' && c.approved_at);
        if (lastProcessedCard) {
          setUserCard(null); // No active pending card
          
          const approvedAt = new Date(lastProcessedCard.approved_at!).getTime();
          const now = new Date().getTime();
          const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
          const diff = now - approvedAt;

          if (diff < threeDaysInMs) {
            const remaining = threeDaysInMs - diff;
            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            setCooldownRemaining(`${days}d ${hours}h ${minutes}m`);
          } else {
            setCooldownRemaining(null);
          }
        } else {
          setUserCard(null);
          setCooldownRemaining(null);
        }
      } else {
        setUserCard(null);
        setCooldownRemaining(null);
      }
    } catch (err) {
      console.error('User card load error:', err);
    } finally {
      setSubmitPageLoading(false);
    }
  };

  const revertCard = async () => {
    if (!userCard || userCard.status !== 'pending') return;
    
    const cardId = userCard.id;
    setSubmitLoading(true);
    
    // Optimistically clear the card from UI
    setUserCard(null);

    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);

      if (error) {
        showAlert('Failed to revert: ' + error.message, 'error');
        // If it failed, reload to bring it back
        loadUserCard();
      } else {
        showAlert('Card submission reverted successfully.', 'success');
        loadUserCard();
      }
    } catch (err) {
      console.error('Revert error:', err);
      loadUserCard();
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleApproveClick = (card: Card) => {
    setIsDirectAdd(false);
    setSelectedCard(card);
    setApproveBid(card.bid_amount?.toString() || '');
    setApproveBuyer(card.buyer || '');
    setShowApprovalModal(true);
  };

  const handleDirectAddClick = () => {
    setIsDirectAdd(true);
    setSelectedCard(null);
    setDirectCardName('');
    setDirectTier('6');
    setApproveBid('');
    setApproveBuyer('');
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    if (!isDirectAdd && !selectedCard) return;
    if (!approveBid || !approveBuyer || (isDirectAdd && !directCardName)) {
      showAlert('Please fill in all required fields.', 'error');
      return;
    }

    setIsApproving(true);
    
    try {
      if (isDirectAdd) {
        const { error } = await supabase
          .from('cards')
          .insert({
            card_name: directCardName,
            tier: parseInt(directTier),
            status: 'approved',
            bid_amount: parseFloat(approveBid),
            buyer: approveBuyer,
            submitted_by: user?.id,
            approved_at: new Date().toISOString()
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cards')
          .update({
            status: 'approved',
            bid_amount: parseFloat(approveBid),
            buyer: approveBuyer,
            approved_at: new Date().toISOString()
          })
          .eq('id', selectedCard!.id);

        if (error) throw error;
      }

      showAlert(isDirectAdd ? 'Card added successfully!' : 'Card approved successfully!', 'success');
      setShowApprovalModal(false);
      loadAdminCards();
      loadLeaderboard();
    } catch (error: any) {
      showAlert('Operation failed: ' + error.message, 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const updateCardStatus = async (id: string, newStatus: 'blacklisted' | 'approved') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('cards')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        showAlert('Action failed: ' + error.message, 'error');
      } else {
        showAlert(`Card ${newStatus === 'blacklisted' ? 'blacklisted' : 'restored'} successfully!`, 'success');
        loadAdminCards();
        loadLeaderboard();
      }
    } catch (err) {
      console.error('Status update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!authEmail || !authPassword) {
      showAlert('Please fill in all fields.', 'error');
      return;
    }

    if (authTab === 'signup' && authPassword !== confirmPassword) {
      showAlert('Passwords do not match.', 'error');
      return;
    }

    if (authTab === 'signup' && authPassword.length < 6) {
      showAlert('Password must be at least 6 characters.', 'error');
      return;
    }

    setAuthLoading(true);
    let result;
    if (authTab === 'login') {
      result = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    } else {
      result = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    }

    setAuthLoading(false);

    if (result.error) {
      showAlert(result.error.message, 'error');
      return;
    }

    if (authTab === 'signup' && !result.data.session) {
      showAlert('Account created! Check your email to confirm.', 'success');
      return;
    }

    setCurrentPage('submit');
    setAuthEmail('');
    setAuthPassword('');
    setConfirmPassword('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentPage('leaderboard');
  };

  const submitCard = async () => {
    if (!user) {
      setCurrentPage('auth');
      return;
    }

    if (userCard && userCard.status === 'pending') {
      showAlert('You already have a pending submission.', 'error');
      return;
    }

    if (cooldownRemaining) {
      showAlert(`Cooldown active. Please wait ${cooldownRemaining}.`, 'error');
      return;
    }

    if (!cardName) {
      showAlert('Please enter a card name.', 'error');
      return;
    }

    setSubmitLoading(true);
    const { error } = await supabase.from('cards').insert({
      card_name: cardName,
      tier: 6,
      status: 'pending',
      submitted_by: user.id
    });

    setSubmitLoading(false);

    if (error) {
      showAlert('Submission failed: ' + error.message, 'error');
      return;
    }

    setCardName('');
    showAlert('✓ Card submitted successfully! Awaiting admin review.', 'success');
    loadUserCard();
  };

  const formatBid = (amount: number) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return amount.toLocaleString();
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-col items-center px-4 py-6 border-b border-[var(--border)] sticky top-0 bg-[rgba(8,8,8,0.95)] backdrop-blur-xl z-50">
        <div className="text-center mb-6">
          <div className="font-['Bebas_Neue'] text-2xl md:text-3xl tracking-[0.1em] text-[var(--gold)] [text-shadow:0_0_40px_rgba(201,168,76,0.3)]">
            Card Auction Leaderboard
          </div>
          <div className="text-[var(--text)] opacity-50 text-[0.7rem] md:text-[0.8rem] tracking-[0.3em] uppercase mt-1">
            tuijbialnajah
          </div>
        </div>
        
        <div className="w-full max-w-[800px] h-px bg-[var(--border)] mb-6"></div>

        <nav className={`w-full max-w-[800px] grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-1 md:gap-2`}>
          <button 
            className={`nav-btn text-[0.6rem] md:text-[0.7rem] px-1 md:px-4 ${currentPage === 'leaderboard' ? 'active' : ''}`} 
            onClick={() => { setCurrentPage('leaderboard'); loadLeaderboard(); }}
          >
            Leaderboard
          </button>
          <button 
            className={`nav-btn text-[0.6rem] md:text-[0.7rem] px-1 md:px-4 ${currentPage === 'submit' ? 'active' : ''}`} 
            onClick={() => user ? setCurrentPage('submit') : setCurrentPage('auth')}
          >
            Submit Card
          </button>
          {isAdmin && (
            <button 
              className={`nav-btn text-[0.6rem] md:text-[0.7rem] px-1 md:px-4 ${currentPage === 'admin' ? 'active' : ''}`} 
              onClick={() => setCurrentPage('admin')}
            >
              Admin
            </button>
          )}
          {!user ? (
            <button 
              className={`nav-btn text-[0.6rem] md:text-[0.7rem] px-1 md:px-4 ${currentPage === 'auth' ? 'active' : ''}`} 
              onClick={() => setCurrentPage('auth')}
            >
              Login / Sign Up
            </button>
          ) : (
            <button className="nav-btn danger text-[0.6rem] md:text-[0.7rem] px-1 md:px-4" onClick={handleLogout}>Logout</button>
          )}
        </nav>
      </header>

      <main className="relative">
        <AnimatePresence mode="wait">
          {currentPage === 'leaderboard' && (
            <motion.div 
              key="leaderboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-[1100px] mx-auto px-8 py-12"
            >
              <div className="font-['Bebas_Neue'] text-[clamp(3rem,8vw,6rem)] tracking-[0.05em] leading-[0.9] mb-2">
                TOP <span className="text-[var(--gold)]">BIDS</span>
              </div>
              <div className="text-[0.72rem] tracking-[0.3em] uppercase text-[var(--muted)] mb-12">
                Live Auction Leaderboard · Highest Bidders
              </div>
              <div className="bg-[var(--gold)] text-[var(--black)] px-4 py-1.5 text-[0.65rem] tracking-[0.2em] uppercase font-medium mb-8 flex items-center gap-4">
                <div className="w-1.5 h-1.5 bg-[var(--black)] rounded-full animate-[pulse_1.5s_infinite]"></div>
                LIVE AUCTION — RESULTS UPDATED IN REAL TIME
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-3 text-[var(--muted)] text-[0.7rem] tracking-[0.2em] uppercase py-32">
                  <div className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--gold)] rounded-full animate-[spin_0.8s_linear_infinite]"></div>
                  Synchronizing Auction Data...
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-32 border border-dashed border-[var(--border)]">
                  <div className="text-4xl mb-4 opacity-20">VOID</div>
                  <div className="font-['Bebas_Neue'] text-xl tracking-[0.2em] text-[var(--muted)] uppercase">No Active Listings</div>
                  <div className="text-[0.6rem] mt-2 tracking-[0.15em] text-[var(--muted)] opacity-50">Awaiting next auction cycle</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)]">
                  {cards.map((card, index) => (
                    <motion.div 
                      key={card.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-[var(--panel)] group relative flex flex-col"
                    >
                      <div className="card-rank-badge">RANK {index + 1}</div>
                      
                      <div className="aspect-[4/5] bg-[var(--dark)] border-b border-[var(--border)] relative overflow-hidden flex items-center justify-center group-hover:bg-[#1a1a1a] transition-colors duration-500">
                        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--gold)_0%,transparent_70%)]"></div>
                        </div>
                        <div className="font-mono text-[0.5rem] tracking-[0.5em] text-[var(--muted)] uppercase">Asset {card.id.slice(0, 4)}</div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <div className="text-[0.55rem] tracking-[0.3em] uppercase text-[var(--gold)] font-bold">
                            Tier {card.tier || 6}
                          </div>
                          <div className={`text-[0.5rem] tracking-[0.1em] uppercase px-1.5 py-0.5 border ${
                            card.status === 'auctioned' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--muted)] text-[var(--muted)]'
                          }`}>
                            {card.status}
                          </div>
                        </div>

                        <div className="font-['Playfair_Display'] text-xl font-bold mb-6 leading-tight group-hover:text-[var(--gold)] transition-colors">
                          {card.card_name}
                        </div>

                        <div className="mt-auto pt-4 border-t border-[var(--border)] grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[0.5rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-1">Owner</label>
                            <div className="text-[0.75rem] font-mono truncate">{card.buyer || '—'}</div>
                          </div>
                          <div className="text-right">
                            <label className="block text-[0.5rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-1">Valuation</label>
                            <div className="font-['Bebas_Neue'] text-xl text-[var(--gold)] tracking-[0.05em]">
                              {card.bid_amount ? formatBid(card.bid_amount) : '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {currentPage === 'admin' && isAdmin && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-[1100px] mx-auto px-8 py-12"
            >
              <div className="font-['Bebas_Neue'] text-[clamp(3rem,8vw,6rem)] tracking-[0.05em] leading-[0.9] mb-2">
                ADMIN <span className="text-[var(--gold)]">PORTAL</span>
              </div>
              <div className="text-[0.72rem] tracking-[0.3em] uppercase text-[var(--muted)] mb-12">
                Review and Manage Card Submissions
              </div>

              {/* Admin Tabs */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="grid grid-cols-3 gap-2 w-full max-w-[600px]">
                  <button 
                    className={`nav-btn ${adminTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setAdminTab('pending')}
                  >
                    Pending
                  </button>
                  <button 
                    className={`nav-btn ${adminTab === 'approved' ? 'active' : ''}`}
                    onClick={() => setAdminTab('approved')}
                  >
                    Approved
                  </button>
                  <button 
                    className={`nav-btn ${adminTab === 'blacklisted' ? 'active' : ''}`}
                    onClick={() => setAdminTab('blacklisted')}
                  >
                    Blacklist
                  </button>
                </div>

                {adminTab === 'pending' && (
                  <button 
                    onClick={handleDirectAddClick}
                    className="nav-btn primary flex items-center gap-2 py-2.5"
                  >
                    <span className="text-lg leading-none">+</span>
                    <span>Direct Add Card</span>
                  </button>
                )}
              </div>

              {alert && <div className={`alert ${alert.type}`}>{alert.message}</div>}

              {loading ? (
                <div className="flex items-center justify-center gap-3 text-[var(--muted)] text-[0.7rem] tracking-[0.2em] uppercase py-16">
                  <div className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--gold)] rounded-full animate-[spin_0.8s_linear_infinite]"></div>
                  Loading requests...
                </div>
              ) : adminCards.filter(c => adminTab === 'approved' ? (c.status === 'approved' || c.status === 'auctioned') : c.status === adminTab).length === 0 ? (
                <div className="text-center py-24 text-[var(--muted)]">
                  <div className="text-6xl mb-4 opacity-30">📋</div>
                  <div className="font-['Bebas_Neue'] text-2xl tracking-[0.1em]">No {adminTab} Requests</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[0.6rem] tracking-[0.2em] uppercase text-[var(--muted)]">
                        <th className="py-4 px-4">Card Name</th>
                        <th className="py-4 px-4">Tier</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-4">Current Bid</th>
                        <th className="py-4 px-4">Buyer</th>
                        <th className="py-4 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminCards
                        .filter(card => adminTab === 'approved' ? (card.status === 'approved' || card.status === 'auctioned') : card.status === adminTab)
                        .map((card) => (
                        <tr key={card.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="py-4 px-4 font-['Playfair_Display'] text-lg">{card.card_name}</td>
                          <td className="py-4 px-4 text-[var(--gold)]">Tier {card.tier}</td>
                          <td className="py-4 px-4">
                            <span className={`text-[0.6rem] tracking-[0.1em] uppercase px-2 py-1 rounded ${
                              card.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500' : 
                              card.status === 'approved' ? 'bg-green-900/30 text-green-500' : 
                              card.status === 'blacklisted' ? 'bg-red-900/30 text-red-500' :
                              'bg-blue-900/30 text-blue-500'
                            }`}>
                              {card.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-sm">
                            {card.bid_amount ? formatBid(card.bid_amount) : '—'}
                          </td>
                          <td className="py-4 px-4 text-[var(--muted)] text-sm">{card.buyer || '—'}</td>
                          <td className="py-4 px-4 text-right flex justify-end gap-2">
                            {card.status === 'pending' && (
                              <button 
                                className="nav-btn primary text-[0.6rem] py-1 px-3"
                                onClick={() => handleApproveClick(card)}
                              >
                                Approve
                              </button>
                            )}
                            {(card.status === 'approved' || card.status === 'auctioned') && (
                              <>
                                <button 
                                  className="nav-btn text-[0.6rem] py-1 px-3"
                                  onClick={() => handleApproveClick(card)}
                                >
                                  Update
                                </button>
                                <button 
                                  className="nav-btn danger text-[0.6rem] py-1 px-3"
                                  onClick={() => updateCardStatus(card.id, 'blacklisted')}
                                >
                                  Blacklist
                                </button>
                              </>
                            )}
                            {card.status === 'blacklisted' && (
                              <button 
                                className="nav-btn primary text-[0.6rem] py-1 px-3"
                                onClick={() => updateCardStatus(card.id, 'approved')}
                              >
                                Restore
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {currentPage === 'auth' && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="min-h-[calc(100vh-80px)] flex items-center justify-center p-8"
            >
              <div className="w-full max-w-[420px] bg-[var(--panel)] border border-[var(--border)] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--gold)] via-[var(--gold-dim)] to-transparent"></div>
                <div className="p-8 pb-6 border-b border-[var(--border)]">
                  <div className="font-['Bebas_Neue'] text-3xl tracking-[0.1em] text-[var(--gold)]">Access Portal</div>
                  <div className="text-[0.65rem] tracking-[0.2em] uppercase text-[var(--muted)] mt-1">Sign in to submit cards</div>
                </div>
                <div className="p-8">
                  <div className="flex mb-8 border-b border-[var(--border)]">
                    <button 
                      className={`flex-1 bg-none border-none text-[var(--muted)] font-mono text-[0.7rem] tracking-[0.15em] uppercase p-3 cursor-pointer border-b-2 transition-all duration-200 -mb-[1px] ${authTab === 'login' ? 'text-[var(--gold)] border-b-[var(--gold)]' : 'border-b-transparent'}`}
                      onClick={() => setAuthTab('login')}
                    >
                      Login
                    </button>
                    <button 
                      className={`flex-1 bg-none border-none text-[var(--muted)] font-mono text-[0.7rem] tracking-[0.15em] uppercase p-3 cursor-pointer border-b-2 transition-all duration-200 -mb-[1px] ${authTab === 'signup' ? 'text-[var(--gold)] border-b-[var(--gold)]' : 'border-b-transparent'}`}
                      onClick={() => setAuthTab('signup')}
                    >
                      Sign Up
                    </button>
                  </div>

                  {alert && <div className={`alert ${alert.type}`}>{alert.message}</div>}

                  <div className="mb-5">
                    <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="your@email.com" 
                    />
                  </div>
                  <div className="mb-5">
                    <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••" 
                    />
                  </div>
                  {authTab === 'signup' && (
                    <div className="mb-5">
                      <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Confirm Password</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••" 
                      />
                    </div>
                  )}

                  <button 
                    className="btn" 
                    disabled={authLoading}
                    onClick={handleAuth}
                  >
                    {authLoading ? 'Please wait...' : authTab === 'login' ? 'Login' : 'Create Account'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === 'submit' && (
            <motion.div 
              key="submit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-[560px] mx-auto px-8 py-12"
            >
              <div className="font-['Bebas_Neue'] text-[clamp(3rem,8vw,6rem)] tracking-[0.05em] leading-[0.9] mb-2">
                SUBMIT <span className="text-[var(--gold)]">CARD</span>
              </div>
              <div className="text-[0.72rem] tracking-[0.3em] uppercase text-[var(--muted)] mb-12">
                Request a card for auction review
              </div>

              {user && (
                <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.1)] border border-[var(--gold-dim)] px-4 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase text-[var(--gold)] mb-8">
                  <div className="w-1.5 h-1.5 bg-[var(--green)] rounded-full"></div>
                  <span>{user.email}</span>
                </div>
              )}

              {alert && <div className={`alert ${alert.type}`}>{alert.message}</div>}

              {submitPageLoading ? (
                <div className="flex items-center justify-center gap-3 text-[var(--muted)] text-[0.7rem] tracking-[0.2em] uppercase py-16">
                  <div className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--gold)] rounded-full animate-[spin_0.8s_linear_infinite]"></div>
                  Checking status...
                </div>
              ) : userCard && userCard.status === 'pending' ? (
                <div className="bg-[var(--panel)] border border-[var(--gold-dim)] p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--gold)]"></div>
                  <div className="text-[0.6rem] tracking-[0.3em] uppercase text-[var(--gold)] mb-4 font-bold">
                    Active Submission
                  </div>
                  <div className="font-['Playfair_Display'] text-2xl font-bold mb-2">
                    {userCard.card_name}
                  </div>
                  <div className="text-[0.65rem] tracking-[0.1em] uppercase text-[var(--muted)] mb-8">
                    Status: <span className="text-yellow-500">Awaiting Admin Review</span>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <div className="p-4 bg-[var(--dark)] border border-[var(--border)] text-[0.65rem] text-[var(--muted)] leading-relaxed">
                      You currently have a pending submission. You must wait for it to be approved or revert it to submit a different card.
                    </div>
                    <button 
                      className="nav-btn danger w-full py-3" 
                      disabled={submitLoading}
                      onClick={revertCard}
                    >
                      {submitLoading ? 'Reverting...' : 'Revert Submission'}
                    </button>
                  </div>
                </div>
              ) : cooldownRemaining ? (
                <div className="bg-[var(--panel)] border border-[var(--border)] p-8 relative overflow-hidden text-center">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--red)] opacity-50"></div>
                  <div className="text-4xl mb-4 opacity-20">⏳</div>
                  <div className="font-['Bebas_Neue'] text-2xl tracking-[0.1em] text-[var(--muted)] mb-2">
                    Cooldown Active
                  </div>
                  <div className="text-[0.65rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-6">
                    Next submission available in
                  </div>
                  <div className="font-mono text-2xl text-[var(--gold)] tracking-[0.1em] mb-8">
                    {cooldownRemaining}
                  </div>
                  <div className="text-[0.6rem] text-[var(--muted)] opacity-50 italic">
                    * There is a 3-day cooldown between successful submissions.
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--panel)] border border-[var(--border)] p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--gold)] to-transparent"></div>
                  <div className="mb-5">
                    <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Tier</label>
                    <input type="text" className="form-control text-[var(--gold)] font-medium" value="6" disabled />
                  </div>
                  <div className="mb-5">
                    <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Card Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Enter card name..." 
                    />
                  </div>
                  <button 
                    className="btn" 
                    disabled={submitLoading}
                    onClick={submitCard}
                  >
                    {submitLoading ? 'Submitting...' : 'Submit Card for Review'}
                  </button>
                </div>
              )}

              <div className="mt-4 text-[0.65rem] text-[var(--muted)] tracking-[0.1em] leading-[1.8]">
                * Submitted cards are reviewed before appearing on the leaderboard.<br />
                * Your submission will be visible only after admin approval.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-[var(--border)] py-12 px-8 mt-20">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="text-[var(--muted)] text-[0.7rem] tracking-[0.15em] uppercase opacity-60">
            This is an experimental project made by Tuijbialnajah
          </div>
        </div>
      </footer>

      {/* Approval / Direct Add Modal */}
      <AnimatePresence>
        {showApprovalModal && (isDirectAdd || selectedCard) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApprovalModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[420px] bg-[var(--panel)] border border-[var(--border)] overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--gold)] via-[var(--gold-dim)] to-transparent"></div>
              <div className="p-8 pb-6 border-b border-[var(--border)]">
                <div className="font-['Bebas_Neue'] text-2xl tracking-[0.1em] text-[var(--gold)]">
                  {isDirectAdd ? 'Direct Add Card' : 'Approve Submission'}
                </div>
                <div className="text-[0.65rem] tracking-[0.2em] uppercase text-[var(--muted)] mt-1">
                  {isDirectAdd ? 'Enter details for a new leaderboard entry' : `Enter auction details for ${selectedCard?.card_name}`}
                </div>
              </div>
              <div className="p-8">
                {isDirectAdd ? (
                  <>
                    <div className="mb-5">
                      <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Card Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={directCardName}
                        onChange={(e) => setDirectCardName(e.target.value)}
                        placeholder="Enter card name..." 
                      />
                    </div>
                    <div className="mb-5">
                      <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Tier</label>
                      <select 
                        className="form-control"
                        value={directTier}
                        onChange={(e) => setDirectTier(e.target.value)}
                      >
                        {[1,2,3,4,5,6].map(t => <option key={t} value={t}>Tier {t}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="mb-5">
                    <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Card Name</label>
                    <input type="text" className="form-control opacity-50" value={selectedCard?.card_name} disabled />
                  </div>
                )}

                <div className="mb-5">
                  <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Bid Amount</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={approveBid}
                    onChange={(e) => setApproveBid(e.target.value)}
                    placeholder="e.g. 50000" 
                  />
                </div>
                <div className="mb-5">
                  <label className="block text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted)] mb-2">Buyer Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={approveBuyer}
                    onChange={(e) => setApproveBuyer(e.target.value)}
                    placeholder="Enter buyer name..." 
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    className="nav-btn flex-1" 
                    onClick={() => setShowApprovalModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn flex-1 mt-0" 
                    disabled={isApproving}
                    onClick={submitApproval}
                  >
                    {isApproving ? 'Processing...' : isDirectAdd ? 'Add Card' : 'Approve Card'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
