import { useState, useEffect, useRef } from 'react';
import { useSiftStore } from '../store';
import { UserPlus, Users, Search, Pencil } from 'lucide-react';
import { onUserSearch, addContact, onContactsChange } from '../services/backend';
import { isSearchableNumber } from '../utils/phone';
import { CIRCLE_META } from '../moderation/profiles';
import { ContactProfileModal } from '../components/ContactProfileModal';

export function Contacts() {
  const currentUserId = useSiftStore(s => s.currentUserId);
  const upsertContact = useSiftStore(s => s.upsertContact);
  const openConversation = useSiftStore(s => s.openConversation);
  const contacts = useSiftStore(s => s.contacts);
  const setBanner = useSiftStore(s => s.setBanner);
  const [searchPhone, setSearchPhone] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchDone, setSearchDone] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendContacts, setBackendContacts] = useState<Record<string, any>>({});
  const longPressFiredRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchRef = useRef<(() => void) | null>(null);

  // Keep backend contacts flowing into both this screen and the local store,
  // so the chat list and conversation screen can render them.
  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = onContactsChange(currentUserId, (contacts) => {
      setBackendContacts(contacts);
      const local = new Set(useSiftStore.getState().contacts.map(c => c.id));
      for (const [id, c] of Object.entries<any>(contacts)) {
        upsertContact({
          id,
          // The saved name belongs to THIS user's view — the other person's
          // registered name is only the default for contacts we don't have yet.
          name: local.has(id) ? '' : (c.displayName || c.phone || 'Unknown'),
          phone: c.phone,
          online: c.online,
        });
      }
    });
    return unsubscribe;
  }, [currentUserId, upsertContact]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    activeSearchRef.current?.();
  }, []);

  const handleSearch = (phone: string) => {
    setSearchPhone(phone);
    setSearchResult(null);
    setSearchDone(false);
    setSearchError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    activeSearchRef.current?.();
    activeSearchRef.current = null;

    if (!isSearchableNumber(phone)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      let answered = false;
      activeSearchRef.current = onUserSearch(phone, (user, error) => {
        answered = true;
        setLoading(false);
        setSearchDone(true);
        if (error) setSearchError(error);
        const found = user && user.id !== currentUserId ? user : null;
        setSearchResult(found);
        setNewName(found ? (found.displayName || found.phone || '') : '');
      });
      // Flaky network: don't leave the spinner hanging forever.
      setTimeout(() => {
        if (!answered) {
          setLoading(false);
          setSearchDone(true);
        }
      }, 8000);
    }, 400);
  };

  const handleAddContact = async (contactUser: any) => {
    if (!currentUserId) return;
    const finalName = newName.trim() || contactUser.displayName || contactUser.phone;

    try {
      // Already a contact? Just save the (new) name — backend row exists.
      if (!contacts.find(c => c.id === contactUser.id)) {
        await addContact(currentUserId, contactUser.id, contactUser.phone);
      }
      upsertContact({
        id: contactUser.id,
        name: finalName,
        phone: contactUser.phone,
        online: contactUser.online,
      });
      setSearchPhone('');
      setSearchResult(null);
      setSearchDone(false);
      setBanner(`✓ ${finalName} saved to contacts`);
    } catch (err: any) {
      setSearchError(err?.message || 'Could not save contact — check your connection and try again.');
    }
  };

  const handleContactMouseDown = (contactId: string) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setProfileId(contactId);
    }, 500);
  };

  const handleContactMouseUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const handleContactClick = (contactId: string) => {
    // A long-press already opened the options menu — don't also open the chat.
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
    openConversation(contactId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Screen title lives in the app header (App.tsx) — no local header. */}
      {profileId && <ContactProfileModal contactId={profileId} onClose={() => setProfileId(null)} />}

      {/* Search */}
      <div className="px-4 py-3 space-y-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input
            type="tel"
            placeholder="Search by number (with or without country code)"
            value={searchPhone}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none"
          />
        </div>

        {loading && (
          <div className="text-xs text-[var(--text-secondary)]">Searching...</div>
        )}

        {searchDone && !searchResult && !loading && (
          searchError ? (
            <div className="text-xs text-red-400">
              Search failed: {searchError}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-secondary)]">
              No Strenes account found for that number. Ask them to open
              Strenes, sign in with their number and finish the name step —
              then search again. (Include the country code, e.g. +91…)
            </div>
          )
        )}

        {searchResult && (
          <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--text)]">
                  {searchResult.displayName}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {searchResult.phone}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name (e.g. Amit)"
                  className="w-28 px-2 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={() => handleAddContact(searchResult)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-semibold"
                >
                  <UserPlus size={15} />
                  {contacts.find(c => c.id === searchResult.id) ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contacts List — bottom padding clears the fixed nav pill */}
      <div className="flex-1 overflow-y-auto nav-pad">
        {Object.entries(backendContacts).length > 0 || contacts.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {(() => {
              const contactList = Object.entries(backendContacts).length > 0
                ? Object.entries(backendContacts)
                : contacts.map(c => [c.id, { displayName: c.name, phone: c.phone, online: c.online }] as [string, any]);
              return contactList.map(([contactId, contactData]: [string, any]) => {
              const local = contacts.find(c => c.id === contactId);
              const shownName = local?.name || contactData.displayName || contactData.phone || 'Unknown';
              const contactCircle = local?.circle;
              const circleInfo = contactCircle ? CIRCLE_META[contactCircle] : null;
              return (
                <button
                  key={contactId}
                  onMouseDown={() => handleContactMouseDown(contactId)}
                  onMouseUp={handleContactMouseUp}
                  onTouchStart={() => handleContactMouseDown(contactId)}
                  onTouchEnd={handleContactMouseUp}
                  onClick={() => handleContactClick(contactId)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--surface)] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text)]">
                        {shownName}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {contactData.phone}
                      </div>
                      <div className={`text-xs mt-1 ${contactData.online ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
                        {contactData.online ? '● Online' : '● Offline'}
                      </div>
                    </div>
                    {circleInfo && (
                      <div className="ml-2 text-lg flex items-center">
                        {circleInfo.emoji}
                      </div>
                    )}
                    <span
                      onClick={e => { e.stopPropagation(); setProfileId(contactId); }}
                      className="ml-2 p-2 rounded-lg hover:bg-[var(--surface)] text-[var(--text-secondary)]"
                    >
                      <Pencil size={15} />
                    </span>
                  </div>
                </button>
              );
            });
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Users size={48} className="text-[var(--text-secondary)] mb-3 opacity-50" />
            <p className="text-[var(--text-secondary)]">No contacts yet</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Search by phone number to add friends
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
