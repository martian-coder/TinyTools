import { useState, useEffect } from 'react';
import { useSiftStore } from '../store';
import { UserPlus, Users, Search } from 'lucide-react';
import { onUserSearch, addContact, onContactsChange } from '../services/firebase';

export function Contacts() {
  const currentUserId = useSiftStore(s => s.currentUserId);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [firebaseContacts, setFirebaseContacts] = useState<any>({});

  // Load Firebase contacts
  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = onContactsChange(currentUserId, setFirebaseContacts);
    return unsubscribe;
  }, [currentUserId]);

  const handleSearch = (phone: string) => {
    setSearchPhone(phone);
    setSearchResult(null);

    if (phone.length < 5) return;

    setLoading(true);
    const unsubscribe = onUserSearch(phone, (user) => {
      if (user && user.id !== currentUserId) {
        setSearchResult(user);
        setLoading(false);
      }
    });

    // Cleanup after timeout
    const timeout = setTimeout(() => {
      unsubscribe();
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  };

  const handleAddContact = async (contactUser: any) => {
    if (!currentUserId) return;

    try {
      await addContact(currentUserId, contactUser.id, contactUser.phone);
      setSearchPhone('');
      setSearchResult(null);
      // Contact added (Firebase listener will update)
    } catch (err) {
      console.error('Error adding contact:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--base)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h1 className="text-lg font-bold text-[var(--text)]">Contacts</h1>
      </div>

      {/* Search */}
      <div className="px-4 py-3 space-y-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input
            type="tel"
            placeholder="Search by phone..."
            value={searchPhone}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none"
          />
        </div>

        {loading && (
          <div className="text-xs text-[var(--text-secondary)]">Searching...</div>
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

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(firebaseContacts).length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {Object.entries(firebaseContacts).map(([contactId, contactData]: [string, any]) => (
              <div key={contactId} className="px-4 py-3 hover:bg-[var(--surface)] cursor-pointer">
                <div className="font-medium text-[var(--text)]">
                  {contactData.displayName || 'Unknown'}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {contactData.phone}
                </div>
                <div className={`text-xs mt-1 ${contactData.online ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
                  {contactData.online ? '● Online' : '● Offline'}
                </div>
              </div>
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
