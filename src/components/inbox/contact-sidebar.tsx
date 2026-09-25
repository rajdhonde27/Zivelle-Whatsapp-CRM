"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, PipelineStage } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { addContactTag, deleteContactTag } from "@/lib/contacts/tag-api";
import { toast } from "sonner";

interface ContactSidebarProps {
  contact: Contact | null;
  className?: string;
  onClose?: () => void;
}

export function ContactSidebar({ contact, className, onClose }: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [tagActionLoading, setTagActionLoading] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, all account tags, and pipeline stages in parallel
    const [dealsRes, notesRes, tagsRes, allTagsRes, stagesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      supabase
        .from("tags")
        .select("*")
        .order("name"),
      supabase
        .from("pipeline_stages")
        .select("*")
        .order("position"),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (stagesRes.data) setStages(stagesRes.data);
    if (allTagsRes.data) setAvailableTags(allTagsRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  useEffect(() => {
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    const handle = contact ? contactHandle(contact) : "";
    if (!handle) return;
    await navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const handleAddTag = useCallback(
    async (tagId: string) => {
      if (!contact || tagActionLoading) return;
      setTagActionLoading(true);
      try {
        await addContactTag(contact.id, tagId);
        await fetchContactData();
        toast.success("Tag added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add tag");
      } finally {
        setTagActionLoading(false);
      }
    },
    [contact, tagActionLoading, fetchContactData]
  );

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      if (!contact || tagActionLoading) return;
      setTagActionLoading(true);
      try {
        await deleteContactTag(contact.id, tagId);
        await fetchContactData();
        toast.success("Tag removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove tag");
      } finally {
        setTagActionLoading(false);
      }
    },
    [contact, tagActionLoading, fetchContactData]
  );

  const handleMoveDealStage = useCallback(
    async (dealId: string, newStageId: string) => {
      const supabase = createClient();
      const newStage = stages.find((s) => s.id === newStageId);
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, stage_id: newStageId, stage: newStage } : d
        )
      );

      const { error } = await supabase
        .from("deals")
        .update({ stage_id: newStageId })
        .eq("id", dealId);

      if (error) {
        toast.error("Failed to update deal stage");
        fetchContactData();
      } else {
        toast.success("Deal stage updated");
      }
    },
    [stages, fetchContactData]
  );

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className={cn("flex h-full w-70 items-center justify-center border-l border-border bg-card", className)}>
        <p className="text-sm text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const initials = displayName.charAt(0).toUpperCase();
  const unassignedTags = availableTags.filter(
    (at) => !tags.some((t) => t.id === at.id)
  );

  return (
    <div className={cn("flex h-full w-70 flex-col border-l border-border bg-card", className)}>
      {onClose && (
        <div className="flex items-center justify-between border-b border-border p-3 lg:hidden">
          <span className="text-sm font-semibold">{tSidebar("contactInfo")}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">
                {contactHandle(contact)}
              </span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Tags / Labels */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-2">
                <TagIcon className="h-3 w-3" />
                {tSidebar("tags")}
              </div>

              {/* Add Tag Dropdown */}
              {unassignedTags.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={tagActionLoading}
                    className="flex h-5 items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Tag
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 border-border bg-popover">
                    {unassignedTags.map((tag) => (
                      <DropdownMenuItem
                        key={tag.id}
                        onClick={() => handleAddTag(tag.id)}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noTags")}</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="opacity-70 hover:opacity-100"
                      title="Remove tag"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Active Deals / Pipeline Stage */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {tSidebar("deals")}
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noDeals")}</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-border bg-muted/50 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {deal.title}
                      </p>
                      <span className="text-xs font-medium text-foreground">
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                    </div>

                    {/* Stage Selector */}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Stage:</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: deal.stage ? `${deal.stage.color}25` : "var(--muted)",
                            color: deal.stage?.color ?? "inherit",
                          }}
                        >
                          <span>{deal.stage?.name ?? "No stage"}</span>
                          <ChevronDown className="h-2.5 w-2.5 opacity-70" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 border-border bg-popover">
                          {stages.map((stage) => (
                            <DropdownMenuItem
                              key={stage.id}
                              onClick={() => handleMoveDealStage(deal.id, stage.id)}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              {stage.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              {tSidebar("notes")}
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={tSidebar("addNotePlaceholder")}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
