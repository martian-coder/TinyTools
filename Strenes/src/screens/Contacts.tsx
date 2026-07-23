import { useState, useEffect, useRef } from 'react';
import { useSiftStore } from '../store';
import { UserPlus, Users, Search, X, Trash2, Ban, MessageCircle } from 'lucide-react';
import { onUserSearch, addContact, onContactsChange } from '../services/backend';
import { isSearchableNumber } from '../utils/phone';
import { CIRCLE_META, type Circle } from '../moderation/profiles';

export function Contacts() {
  const currentUserId = useSiftStore(s => s.currentUserId);
  const upsertContact = useSiftStore(s => s.upsertContact);
  const openConversation = useSiftStore(s => s.openConversation);
  const setContactCircle = useSiftStore(s => s.setContactCircle);
  const removeContact = useSiftStore(s => s.removeContact);
  const setBlocked = useSiftStore(s => s.setBlocked);
  const contacts = useSiftStore(s => s.contacts);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchDone, setSearchDone] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendContacts, setBackendContacts] = useState<Record<string, any>>({});
  const [circleModalContactId, setCircleModalContactId] = useState<string | null>(null);
  const [longPressActive, setLongPressActive] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchRef = useRef<(() => void) | null>(null);

  // Keep backend contacts flowing into both this screen and the local store,
  // so the chat list and conversation screen can render them.
  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = onContactsChange(currentUserId, (contacts) => {
      setBackendContacts(contacts);
      for (const [id, c] of Object.entries<any>(contacts)) {
        upsertContact({
          id,
          name: c.displayName || c.phone || 'Unknown',
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

    try {
      await addContact(currentUserId, contactUser.id, contactUser.phone);
      upsertContact({
        id: contactUser.id,
        name: newName.trim() || contactUser.displayName || contactUser.phone,
        phone: contactUser.phone,
        online: contactUser.online,
      });
      setSearchPhone('');
      setSearchResult(null);
      setSearchDone(false);
    } catch (err) {
      console.error('Error adding contact:', err);
    }
  };

  const handleContactMouseDown = (contactId: string) => {
    setLongPressActive(true);
    longPressTimerRef.current = setTimeout(() => {
      setCircleModalContactId(contactId);
    }, 500);
  };

  const handleContactMouseUp = (contactId: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (!longPressActive) return;
    setLongPressActive(false);
    if (circleModalContactId !== contactId) {
      openConversation(contactId);
    }
  };

  const handleSetCircle = (contactId: string, circle: Circle | undefined) => {
    setContactCircle(contactId, circle);
    setCircleModalContactId(null);
  };

  const contact = circleModalContactId
    ? contacts.find(c => c.id === circleModalContactId)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Screen title lives in the app header (App.tsx) — no local header. */}

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
                  className="p-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contacts List — bottom padding clears the fixed nav pill */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(var(--nav-height) + 16px)' }}>
        {Object.entries(backendContacts).length > 0 || contacts.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {(() => {
              const contactList = Object.entries(backendContacts).length > 0
                ? Object.entries(backendContacts)
                : contacts.map(c => [c.id, { displayName: c.name, phone: c.phone, online: c.online }] as [string, any]);
              return contactList.map(([contactId, contactData]: [string, any]) => {
              const contactCircle = contacts.find(c => c.id === contactId)?.circle;
              const circleInfo = contactCircle ? CIRCLE_META[contactCircle] : null;
              return (
                <button
                  key={contactId}
                  onMouseDown={() => handleContactMouseDown(contactId)}
                  onMouseUp={() => handleContactMouseUp(contactId)}
                  onTouchStart={() => handleContactMouseDown(contactId)}
                  onTouchEnd={() => handleContactMouseUp(contactId)}
                  onClick={() => openConversation(contactId)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--surface)] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text)]">
                        {contactData.displayName || contactData.phone || 'Unknown'}
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

      {circleModalContactId && contact && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end z-50"
          onClick={() => setCircleModalContactId(null)}
        >
          <div
            className="bg-[var(--surface)] w-full rounded-t-xl border border-[var(--border)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[var(--text)]">
                {contact.name}
              </h3>
              <button
                onClick={() => setCircleModalContactId(null)}
                className="p-1 hover:bg-[var(--surface-hover)] rounded-lg"
              >
                <X size={20} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <div className="grid grid-cols-3 gap-2 pb-2 border-b border-[var(--border)] mb-2">
                <button
                  onClick={() => { openConversation(contact.id); setCircleModalContactId(null); }}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text)]"
                >
                  <MessageCircle size={18} /><span className="text-xs">Message</span>
                </button>
                <button
                  onClick={() => { setBlocked(contact.id, !contact.blocked); setCircleModalContactId(null); }}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[var(--surface-hover)] text-amber-400"
                >
                  <Ban size={18} /><span className="text-xs">{contact.blocked ? 'Unblock' : 'Block'}</span>
                </button>
                <button
                  onClick={() => { if (confirm(`Remove ${contact.name}? This deletes the chat.`)) { removeContact(contact.id); setCircleModalContactId(null); } }}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[var(--surface-hover)] text-red-400"
                >
                  <Trash2 size={18} /><span className="text-xs">Remove</span>
                </button>
              </div>
              {(Object.entries(CIRCLE_META) as [Circle, typeof CIRCLE_META[Circle]][]).map(([circleId, meta]) => (
                <button
                  key={circleId}
                  onClick={() => handleSetCircle(contact.id, circleId)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    contact.circle === circleId
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'hover:bg-[var(--surface-hover)] text-[var(--text)]'
                  }`}
                >
                  <span className="text-lg">{meta.emoji}</span>
                  <span className="font-medium">{meta.label}</span>
                </button>
              ))}

              <button
                onClick={() => handleSetCircle(contact.id, undefined)}
                className={`w-full px-4 py-3 rounded-lg transition ${
                  !contact.circle
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    : 'hover:bg-[var(--surface-hover)] text-[var(--text)]'
                }`}
              >
                <span className="font-medium">No circle</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
