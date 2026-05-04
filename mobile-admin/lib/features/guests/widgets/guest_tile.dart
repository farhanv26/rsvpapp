import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/event_sections.dart';
import '../../../core/models/guest.dart';
import '../../../shared/theme/app_theme.dart';

class GuestTile extends StatelessWidget {
  const GuestTile({
    super.key,
    required this.guest,
    required this.eventId,
    this.onMarkInvited,
    this.onMarkUninvited,
    this.onRecordRsvp,
    this.onDelete,
    this.onGetCommsHistory,
    this.onEdit,
    this.onRefresh,
  });

  final Guest guest;
  final String eventId;
  final Future<void> Function(String channel)? onMarkInvited;
  final Future<void> Function()? onMarkUninvited;
  final Future<void> Function(bool attending, {int? count})? onRecordRsvp;
  final Future<void> Function()? onDelete;
  final Future<List<CommunicationLog>> Function()? onGetCommsHistory;
  final VoidCallback? onEdit;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    final phone = guest.fullPhoneDigits;
    final hasPhone = phone.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Top row: avatar + info + status + menu ──
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 8, 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar
                _Avatar(name: guest.guestName, status: guest.status),
                const SizedBox(width: 12),

                // Name + count + metadata
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(guest.guestName, style: AppTextStyles.titleSmall),
                      const SizedBox(height: 3),
                      _CountRow(guest: guest),
                      if (guest.group != null || guest.tableName != null) ...[
                        const SizedBox(height: 5),
                        Wrap(
                          spacing: 6,
                          children: [
                            if (guest.group != null)
                              _MetaTag(icon: Icons.label_outline_rounded, label: guest.group!),
                            if (guest.tableName != null)
                              _MetaTag(icon: Icons.table_restaurant_outlined, label: 'T: ${guest.tableName}'),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),

                // Status badge + more menu
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _StatusBadge(status: guest.status, attendingCount: guest.attendingCount),
                    if (guest.excludeFromTotals) ...[
                      const SizedBox(height: 4),
                      _ExcludedBadge(reason: guest.excludeReason),
                    ],
                  ],
                ),
                _MoreMenu(
                  guest: guest,
                  onEdit: onEdit,
                  onDelete: onDelete,
                  onMarkUninvited: guest.invitedAt != null ? onMarkUninvited : null,
                  onCommsHistory: onGetCommsHistory,
                  onRefresh: onRefresh,
                ),
              ],
            ),
          ),

          // ── Contact info ──
          if (guest.phone != null || guest.email != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
              child: Wrap(
                spacing: 10,
                runSpacing: 4,
                children: [
                  if (guest.phone != null)
                    _ContactChip(
                      icon: Icons.phone_outlined,
                      label: guest.phone!,
                      onTap: () => _copy(context, guest.phone!),
                    ),
                  if (guest.email != null)
                    _ContactChip(
                      icon: Icons.email_outlined,
                      label: guest.email!,
                      onTap: () => _copy(context, guest.email!),
                    ),
                ],
              ),
            ),

          // ── Invite metadata ──
          if (guest.invitedAt != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
              child: Text(
                'Invited ${DateFormat('d MMM').format(guest.invitedAt!)} via ${guest.inviteChannelLastUsed ?? 'manual'}'
                '${guest.inviteCount > 1 ? ' · ${guest.inviteCount}×' : ''}',
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
            ),

          // ── Host message ──
          if (guest.hostMessage != null && guest.hostMessage!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.brandAccentLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.brandAccent.withValues(alpha: 0.15)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.format_quote_rounded, size: 13, color: AppColors.brandAccent),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        guest.hostMessage!,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── Action row ──
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Row(
              children: [
                if (hasPhone) ...[
                  _IconAction(
                    icon: Icons.chat_rounded,
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    onTap: () => _openWhatsApp(phone, guest.greeting),
                  ),
                  const SizedBox(width: 8),
                  _IconAction(
                    icon: Icons.message_rounded,
                    label: 'iMessage',
                    color: AppColors.invited,
                    onTap: () => _openSms(phone),
                  ),
                  const SizedBox(width: 8),
                ],
                if (guest.invitedAt == null && onMarkInvited != null) ...[
                  _IconAction(
                    icon: Icons.check_circle_outline_rounded,
                    label: 'Mark Invited',
                    color: AppColors.brandAccent,
                    onTap: () => _showMarkInvitedSheet(context),
                  ),
                  const SizedBox(width: 8),
                ],
                if (onRecordRsvp != null)
                  _IconAction(
                    icon: Icons.edit_note_rounded,
                    label: 'Record RSVP',
                    color: AppColors.brandAccentBright,
                    onTap: () => _showRsvpSheet(context),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _copy(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Copied: $text'), duration: const Duration(seconds: 2)),
    );
  }

  void _openWhatsApp(String digits, String greeting) {
    final msg = Uri.encodeComponent('$greeting,');
    launchUrl(Uri.parse('https://wa.me/$digits?text=$msg'), mode: LaunchMode.externalApplication);
  }

  void _openSms(String digits) {
    launchUrl(Uri.parse('sms:$digits'), mode: LaunchMode.externalApplication);
  }

  void _showMarkInvitedSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SheetHandle(),
              Text('Mark "${guest.guestName}" as invited', style: AppTextStyles.titleSmall),
              const SizedBox(height: 4),
              const Text('Select how you reached them', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              _ChannelTile(ctx: ctx, icon: Icons.chat_rounded, label: 'WhatsApp', channel: 'whatsapp', color: const Color(0xFF25D366), onMarkInvited: onMarkInvited, onRefresh: onRefresh),
              _ChannelTile(ctx: ctx, icon: Icons.message_rounded, label: 'iMessage / SMS', channel: 'imessage', color: AppColors.invited, onMarkInvited: onMarkInvited, onRefresh: onRefresh),
              _ChannelTile(ctx: ctx, icon: Icons.email_outlined, label: 'Email', channel: 'email', color: AppColors.brandAccent, onMarkInvited: onMarkInvited, onRefresh: onRefresh),
              _ChannelTile(ctx: ctx, icon: Icons.person_rounded, label: 'In person / manual', channel: 'manual', color: AppColors.textSecondary, onMarkInvited: onMarkInvited, onRefresh: onRefresh),
            ],
          ),
        ),
      ),
    );
  }

  void _showRsvpSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
      ),
      builder: (ctx) => _RsvpSheet(guest: guest, onRecordRsvp: onRecordRsvp, onRefresh: onRefresh),
    );
  }
}

// ── Avatar ─────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, required this.status});
  final String name;
  final GuestStatus status;

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final color = switch (status) {
      GuestStatus.attending => AppColors.attending,
      GuestStatus.declined => AppColors.declined,
      GuestStatus.pending => AppColors.pending,
      GuestStatus.notInvited => AppColors.textMuted,
    };

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Center(
        child: Text(
          initial,
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color),
        ),
      ),
    );
  }
}

// ── Count row ──────────────────────────────────────────────────────

class _CountRow extends StatelessWidget {
  const _CountRow({required this.guest});
  final Guest guest;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: [
        _CountPill(label: 'M', count: guest.menCount),
        _CountPill(label: 'W', count: guest.womenCount),
        if (guest.kidsCount > 0) _CountPill(label: 'K', count: guest.kidsCount),
        Text(
          '${guest.totalCount} total',
          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
        ),
      ],
    );
  }
}

class _CountPill extends StatelessWidget {
  const _CountPill({required this.label, required this.count});
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label $count',
      style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500),
    );
  }
}

// ── Contact chip ───────────────────────────────────────────────────

class _ContactChip extends StatelessWidget {
  const _ContactChip({required this.icon, required this.label, this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

// ── Meta tag ───────────────────────────────────────────────────────

class _MetaTag extends StatelessWidget {
  const _MetaTag({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 10, color: AppColors.textMuted),
        const SizedBox(width: 3),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
      ],
    );
  }
}

// ── Icon action button ─────────────────────────────────────────────

class _IconAction extends StatelessWidget {
  const _IconAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Status badge ───────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, this.attendingCount});
  final GuestStatus status;
  final int? attendingCount;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (status) {
      GuestStatus.attending => (
          'Attending${attendingCount != null ? " ($attendingCount)" : ""}',
          AppColors.attendingBg,
          AppColors.attending,
        ),
      GuestStatus.declined => ('Declined', AppColors.declinedBg, AppColors.declined),
      GuestStatus.pending => ('Pending', AppColors.pendingBg, AppColors.pending),
      GuestStatus.notInvited => ('Not invited', AppColors.notInvitedBg, AppColors.notInvited),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg, letterSpacing: 0.2),
      ),
    );
  }
}

// ── Excluded badge ─────────────────────────────────────────────────

class _ExcludedBadge extends StatelessWidget {
  const _ExcludedBadge({this.reason});
  final String? reason;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: reason?.isNotEmpty == true ? reason! : 'Excluded from totals',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.warningBg,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: AppColors.warning.withValues(alpha: 0.25)),
        ),
        child: const Text(
          'EXCL.',
          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.warning, letterSpacing: 0.4),
        ),
      ),
    );
  }
}

// ── More menu ──────────────────────────────────────────────────────

class _MoreMenu extends StatelessWidget {
  const _MoreMenu({
    required this.guest,
    this.onEdit,
    this.onDelete,
    this.onMarkUninvited,
    this.onCommsHistory,
    this.onRefresh,
  });
  final Guest guest;
  final VoidCallback? onEdit;
  final Future<void> Function()? onDelete;
  final Future<void> Function()? onMarkUninvited;
  final Future<List<CommunicationLog>> Function()? onCommsHistory;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textMuted),
      color: AppColors.surfaceElevated,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: const BorderSide(color: AppColors.border),
      ),
      itemBuilder: (_) => [
        if (onEdit != null)
          const PopupMenuItem(value: 'edit', child: _MenuItem(icon: Icons.edit_outlined, label: 'Edit guest')),
        if (onMarkUninvited != null)
          const PopupMenuItem(value: 'uninvite', child: _MenuItem(icon: Icons.remove_circle_outline_rounded, label: 'Mark uninvited')),
        if (onCommsHistory != null)
          const PopupMenuItem(value: 'history', child: _MenuItem(icon: Icons.history_rounded, label: 'Communication history')),
        if (onDelete != null)
          const PopupMenuItem(value: 'delete', child: _MenuItem(icon: Icons.delete_outline_rounded, label: 'Delete guest', danger: true)),
      ],
      onSelected: (value) async {
        switch (value) {
          case 'edit':
            onEdit?.call();
          case 'uninvite':
            await onMarkUninvited?.call();
            onRefresh?.call();
          case 'history':
            if (onCommsHistory != null && context.mounted) _showCommsHistory(context);
          case 'delete':
            if (context.mounted) await _confirmDelete(context);
        }
      },
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete guest?'),
        content: Text('Remove "${guest.guestName}" from this event?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await onDelete?.call();
      onRefresh?.call();
    }
  }

  void _showCommsHistory(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.35,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, scrollCtrl) => _CommsHistorySheet(
          guestName: guest.guestName,
          loader: onCommsHistory!,
          scrollController: scrollCtrl,
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({required this.icon, required this.label, this.danger = false});
  final IconData icon;
  final String label;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.danger : AppColors.textPrimary;
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 12),
        Text(label, style: TextStyle(fontSize: 14, color: color)),
      ],
    );
  }
}

// ── Channel tile ───────────────────────────────────────────────────

class _ChannelTile extends StatelessWidget {
  const _ChannelTile({
    required this.ctx,
    required this.icon,
    required this.label,
    required this.channel,
    required this.color,
    required this.onMarkInvited,
    required this.onRefresh,
  });
  final BuildContext ctx;
  final IconData icon;
  final String label;
  final String channel;
  final Color color;
  final Future<void> Function(String channel)? onMarkInvited;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Icon(icon, color: color, size: 18),
      ),
      title: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
      onTap: () async {
        Navigator.pop(ctx);
        await onMarkInvited?.call(channel);
        onRefresh?.call();
      },
    );
  }
}

// ── RSVP sheet ─────────────────────────────────────────────────────

class _RsvpSheet extends StatefulWidget {
  const _RsvpSheet({required this.guest, this.onRecordRsvp, this.onRefresh});
  final Guest guest;
  final Future<void> Function(bool attending, {int? count})? onRecordRsvp;
  final VoidCallback? onRefresh;

  @override
  State<_RsvpSheet> createState() => _RsvpSheetState();
}

class _RsvpSheetState extends State<_RsvpSheet> {
  bool _attending = true;
  late int _count;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _count = widget.guest.attendingCount ?? widget.guest.totalCount.clamp(1, widget.guest.maxGuests);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SheetHandle(),
          const Text('Record RSVP', style: AppTextStyles.titleSmall),
          const SizedBox(height: 2),
          Text(widget.guest.guestName, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(height: 20),

          // Attending / Declined toggle
          Row(
            children: [
              Expanded(
                child: _ToggleBtn(
                  label: 'Attending',
                  selected: _attending,
                  color: AppColors.attending,
                  onTap: () => setState(() => _attending = true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ToggleBtn(
                  label: 'Declined',
                  selected: !_attending,
                  color: AppColors.declined,
                  onTap: () => setState(() => _attending = false),
                ),
              ),
            ],
          ),

          if (_attending) ...[
            const SizedBox(height: 20),
            const Text('Number attending', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            Row(
              children: [
                _CountBtn(icon: Icons.remove_rounded, onTap: () => setState(() => _count = (_count - 1).clamp(1, widget.guest.maxGuests))),
                const SizedBox(width: 24),
                Text('$_count', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(width: 24),
                _CountBtn(icon: Icons.add_rounded, onTap: () => setState(() => _count = (_count + 1).clamp(1, widget.guest.maxGuests))),
                const SizedBox(width: 12),
                Text('of ${widget.guest.maxGuests}', style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
              ],
            ),
          ],

          const SizedBox(height: 24),
          GestureDetector(
            onTap: _saving ? null : _save,
            child: AnimatedOpacity(
              opacity: _saving ? 0.6 : 1.0,
              duration: const Duration(milliseconds: 150),
              child: Container(
                width: double.infinity,
                height: 50,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.brandAccentBright, AppColors.brandAccent],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Center(
                  child: _saving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textInverse))
                      : const Text('Save RSVP', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textInverse)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.onRecordRsvp?.call(_attending, count: _attending ? _count : null);
      if (mounted) Navigator.pop(context);
      widget.onRefresh?.call();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _ToggleBtn extends StatelessWidget {
  const _ToggleBtn({required this.label, required this.selected, required this.color, required this.onTap});
  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.15) : AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: selected ? color : AppColors.border, width: selected ? 1.5 : 1),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: selected ? color : AppColors.textSecondary),
          ),
        ),
      ),
    );
  }
}

class _CountBtn extends StatelessWidget {
  const _CountBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: AppColors.textPrimary),
      ),
    );
  }
}

// ── Sheet handle ───────────────────────────────────────────────────

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 36,
        height: 4,
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
      ),
    );
  }
}

// ── Communication history sheet ────────────────────────────────────

class _CommsHistorySheet extends StatefulWidget {
  const _CommsHistorySheet({
    required this.guestName,
    required this.loader,
    required this.scrollController,
  });
  final String guestName;
  final Future<List<CommunicationLog>> Function() loader;
  final ScrollController scrollController;

  @override
  State<_CommsHistorySheet> createState() => _CommsHistorySheetState();
}

class _CommsHistorySheetState extends State<_CommsHistorySheet> {
  late Future<List<CommunicationLog>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loader();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Column(
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.brandAccent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: const Icon(Icons.history_rounded, size: 16, color: AppColors.brandAccent),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Communication History', style: AppTextStyles.titleSmall),
                        Text(widget.guestName, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        const Divider(height: 1, color: AppColors.borderLight),
        Expanded(
          child: FutureBuilder<List<CommunicationLog>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2));
              }
              if (snap.hasError || snap.data == null) {
                return const Center(
                  child: Text('Could not load history.', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
                );
              }
              final logs = snap.data!;
              if (logs.isEmpty) {
                return const Center(
                  child: Text('No communication history yet.', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
                );
              }
              return ListView.separated(
                controller: widget.scrollController,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                itemCount: logs.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.borderLight),
                itemBuilder: (_, i) => _LogRow(log: logs[i]),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _LogRow extends StatelessWidget {
  const _LogRow({required this.log});
  final CommunicationLog log;

  @override
  Widget build(BuildContext context) {
    final color = log.success ? AppColors.attending : AppColors.danger;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_channelIcon(log.channel), size: 14, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(log.label, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                if (log.detail != null)
                  Text(log.detail!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 3),
                Text(
                  '${DateFormat('d MMM yyyy · h:mm a').format(log.createdAt.toLocal())}'
                  '${log.actorName != null ? ' · ${log.actorName}' : ''}',
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _channelIcon(String channel) {
    return switch (channel) {
      'whatsapp' => Icons.chat_rounded,
      'email' => Icons.email_outlined,
      'imessage' => Icons.message_rounded,
      _ => Icons.person_rounded,
    };
  }
}
