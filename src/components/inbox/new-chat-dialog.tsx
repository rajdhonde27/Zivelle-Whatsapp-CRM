"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact, Conversation } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, MessageSquare, Loader2, Phone, User, Building2 } from "lucide-react";
import { toast } from "sonner";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { useTranslations } from "next-intl";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationStarted: (conversation: Conversation) => void;
}

export function NewChatDialog({
  open,
  onOpenChange,
  onConversationStarted,
}: NewChatDialogProps) {
  const t = useTranslations("Inbox.conversationList");
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [starting, setStarting] = useState(false);

  // New contact form fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setNewName("");
      setNewPhone("");
      setNewCompany("");
      return;
    }

    const loadContacts = async () => {
      setLoadingContacts(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("name", { ascending: true })
        .limit(100);

      if (!error && data) {
        setContacts(data as Contact[]);
      }
      setLoadingContacts(false);
    };

    loadContacts();
  }, [open]);

  const handleStartChat = useCallback(
    async (payload: { contact_id?: string; phone?: string; name?: string }) => {
      setStarting(true);
      try {
        const res = await fetch("/api/inbox/start-conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to start conversation");
        }

        if (data.conversation) {
          onConversationStarted(data.conversation);
          onOpenChange(false);
          toast.success("Chat opened");
        } else {
          toast.error("Conversation opened, please refresh");
          onOpenChange(false);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start chat");
      } finally {
        setStarting(false);
      }
    },
    [onConversationStarted, onOpenChange]
  );

  const handleCreateAndStart = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPhone.trim()) {
        toast.error("Phone number is required");
        return;
      }
      let phone = newPhone.trim();
      if (!phone.startsWith("+")) {
        phone = "+" + phone;
      }
      handleStartChat({
        phone,
        name: newName.trim() || undefined,
      });
    },
    [newPhone, newName, handleStartChat]
  );

  const filteredContacts = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(q) ?? false;
    const phoneMatch = c.phone?.toLowerCase().includes(q) ?? false;
    const companyMatch = c.company?.toLowerCase().includes(q) ?? false;
    return nameMatch || phoneMatch || companyMatch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card p-0 overflow-hidden">
        <DialogHeader className="border-b border-border p-4 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <MessageSquare className="h-5 w-5 text-primary" />
            New WhatsApp Chat
          </DialogTitle>
          <div className="mt-3 flex rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setTab("existing")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                tab === "existing"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Choose Contact
            </button>
            <button
              type="button"
              onClick={() => setTab("new")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                tab === "new"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Add New Contact
            </button>
          </div>
        </DialogHeader>

        {tab === "existing" ? (
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or company..."
                className="pl-9 text-sm"
              />
            </div>

            <ScrollArea className="h-64 rounded-md border border-border">
              {loadingContacts ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No contacts found matching &ldquo;{search}&rdquo;
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 text-xs text-primary"
                    onClick={() => {
                      setNewName(search);
                      setTab("new");
                    }}
                  >
                    + Create &ldquo;{search}&rdquo; as new contact
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      disabled={starting}
                      onClick={() => handleStartChat({ contact_id: contact.id })}
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(contact.name || contact.phone || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {contact.name || contactHandle(contact)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.phone || contactHandle(contact)}
                          {contact.company && ` · ${contact.company}`}
                        </p>
                      </div>
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <form onSubmit={handleCreateAndStart} className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+14155552671"
                  className="pl-9 text-sm"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Include country code (e.g. +1 for US, +91 for India, +44 for UK).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Contact Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Company (Optional)</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={starting || !newPhone.trim()}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {starting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Chat...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Contact & Start Chat
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
