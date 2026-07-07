import { useState, useEffect, useRef } from 'react';
import { useSiftStore } from '../store';
import { UserPlus, Users, Search } from 'lucide-react';
import { onUserSearch, addContact, onContactsChange } from '../services/backend';
import { isValidPhone } from '../utils/phone';

export function Contacts() {
  const currentUserId = useSiftStore(s => s.currentUserId);
  const upsertContact = useSiftStore(s => s.upsertContact);
  const openConversation = useSiftStore(s => s.openConversation);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchDone, setSearchDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendContacts, setBackendContacts] = useState<Record<string, any>>({});
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
    activeSearchRef.current?.();
  }, []);

  const handleSearch = (phone: string) => {
    setSearchPhone(phone);
    setSearchResult(null);
    setSearchDone(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    activeSearchRef.current?.();
    activeSearchRef.current = null;

    if (!isValidPhone(phone)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      let answered = false;
      activeSearchRef.current = onUserSearch(phone, (user) => {
        answered = true;
        setLoading(false);
        setSearchDone(true);
        setSearchResult(user && user.id !== currentUserId ? user : null);
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
        name: contactUser.displayName || contactUser.phone,
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

  return (
    <div className="flex flex-col h-full">
      {/* Screen title lives in the app header (App.tsx) — no local header. */}

      {/* Search */}
      <div className="px-4 py-3 space-y-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input
            type="tel"
            placeholder="Search by phone, e.g. +15551234567"
            value={searchPhone}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none"
          />
        </div>

        {loading && (
          <div className="text-xs text-[var(--text-secondary)]">Searching...</div>
        )}

        {searchDone && !searchResult && !loading && (
          <div className="text-xs text-[var(--text-secondary)]">
            No user found with that number. They need to sign up first.
          </div>
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
              <button
                onClick={() => handleAddContact(searchResult)}
                className="p-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg"
              >
                <UserPlus size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contacts List — bottom padding clears the fixed nav pill */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(var(--nav-height) + 16px)' }}>
        {Object.entries(backendContacts).length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {Object.entries(backendContacts).map(([contactId, contactData]: [string, any]) => (
              <button
                key={contactId}
                onClick={() => openConversation(contactId)}
                className="w-full text-left px-4 py-3 hover:bg-[var(--surface)] cursor-pointer"
              >
                <div className="font-medium text-[var(--text)]">
                  {contactData.displayName || contactData.phone || 'Unknown'}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {contactData.phone}
                </div>
                <div className={`text-xs mt-1 ${contactData.online ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
                  {contactData.online ? '● Online' : '● Offline'}
                </div>
              </button>
            ))}
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
