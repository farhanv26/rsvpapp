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
    final status = guest.status;
    final phone = guest.fullPhoneDigits;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name + status + actions menu
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      guest.guestName,
                      style: AppTextStyles.titleSmall,
                    ),
                    const SizedBox(height: 3),
                    Wrap(
                      spacing: 6,
                      children: [
                        _countChip('M ${guest.menCount}', Icons.man_rounded),
                        _countChip('W ${guest.womenCount}', Icons.woman_rounded),
                        if (guest.kidsCount > 0)
                          _countChip('K ${guest.kidsCount}', Icons.child_care_rounded),
                        Text('· ${guest.totalCount} total',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.textMuted)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _StatusBadge(status: status, attendingCount: guest.attendingCount),
              const SizedBox(width: 4),
              // More actions menu
              _MoreMenu(
                guest: guest,
                onEdit: onEdit,
                onDelete: onDelete,
                onMarkUninvited:
                    guest.invitedAt != null ? onMarkUninvited : null,
                onCommsHistory: onGetCommsHistory,
                onRefresh: onRefresh,
              ),
            ],
          ),

          // Contact info
          if (guest.phone != null || guest.email != null) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (guest.phone != null)
                  _contactChip(Icons.phone_outlined, guest.phone!,
                      onTap: () =>
                          _copyToClipboard(context, guest.phone!)),
                if (guest.email != null)
                  _contactChip(Icons.email_outlined, guest.email!,
                      onTap: () =>
                          _copyToClipboard(context, guest.email!)),
              ],
            ),
          ],

          // Metadata
          if (guest.group != null || guest.tableName != null) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                if (guest.group != null)
                  _metaTag(Icons.label_outline_rounded, guest.group!),
                if (guest.tableName != null)
                  _metaTag(Icons.table_restaurant_outlined,
                      'Table: ${guest.tableName}'),
              ],
            ),
          ],

          if (guest.invitedAt != null) ...[
            const SizedBox(height: 4),
            Text(
              'Invited ${DateFormat('d MMM').format(guest.invitedAt!)} via ${guest.inviteChannelLastUsed ?? 'manual'}'
              '${guest.inviteCount > 1 ? ' · ${guest.inviteCount}x' : ''}',
              style: const TextStyle(
                  fontSize: 11, color: AppColors.textMuted),
            ),
          ],

          if (guest.hostMessage != null &&
              guest.hostMessage!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.brandAccentLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.format_quote_rounded,
                      size: 14, color: AppColors.brandAccent),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(guest.hostMessage!,
                        style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.brandMid,
                            height: 1.4)),
                  ),
                ],
              ),
            ),
          ],

          // Action buttons
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (phone.isNotEmpty)
                _ActionButton(
                  icon: Icons.chat_rounded,
                  label: 'WhatsApp',
                  color: const Color(0xFF25D366),
                  onTap: () => _openWhatsApp(phone, guest.greeting),
                ),
              if (phone.isNotEmpty)
                _ActionButton(
                  icon: Icons.message_rounded,
                  label: 'Message',
                  color: AppColors.invited,
                  onTap: () => _openSms(phone),
                ),
              if (guest.invitedAt == null && onMarkInvited != null)
                _ActionButton(
                  icon: Icons.check_circle_outline_rounded,
                  label: 'Mark invited',
                  color: AppColors.brandMid,
                  onTap: () => _showMarkInvitedSheet(context),
                ),
              if (onRecordRsvp != null)
                _ActionButton(
                  icon: Icons.edit_note_rounded,
                  label: 'Record RSVP',
                  color: AppColors.brandAccent,
                  onTap: () => _showRsvpSheet(context),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _countChip(String label, IconData icon) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.textMuted),
        const SizedBox(width: 2),
        Text(label,
            style: const TextStyle(
                fontSize: 11, color: AppColors.textMuted)),
      ],
    );
  }

  Widget _contactChip(IconData icon, String label,
      {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  Widget _metaTag(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.textMuted),
        const SizedBox(width: 3),
        Text(label,
            style: const TextStyle(
                fontSize: 11, color: AppColors.textMuted)),
      ],
    );
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text('Copied: $text'),
          duration: const Duration(seconds: 2)),
    );
  }

  void _openWhatsApp(String digits, String greeting) {
    final msg = Uri.encodeComponent('$greeting,');
    launchUrl(Uri.parse('https://wa.me/$digits?text=$msg'),
        mode: LaunchMode.externalApplication);
  }

  void _openSms(String digits) {
    launchUrl(Uri.parse('sms:$digits'),
        mode: LaunchMode.externalApplication);
  }

  void _showMarkInvitedSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sheetHandle(),
              const SizedBox(height: 4),
              Text('Mark "${guest.guestName}" as invited',
                  style: AppTextStyles.titleSmall),
              const SizedBox(height: 4),
              const Text('How did you reach them?',
                  style: TextStyle(
                      fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              _channelTile(ctx, Icons.chat_rounded, 'WhatsApp',
                  'whatsapp', const Color(0xFF25D366)),
              _channelTile(ctx, Icons.message_rounded, 'iMessage / SMS',
                  'imessage', AppColors.invited),
              _channelTile(ctx, Icons.email_outlined, 'Email',
                  'email', AppColors.brandAccent),
              _channelTile(ctx, Icons.person_rounded, 'In person / manual',
                  'manual', AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }

  Widget _channelTile(
    BuildContext ctx,
    IconData icon,
    String label,
    String channel,
    Color color,
  ) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: color, size: 18),
      ),
      title: Text(label,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right_rounded,
          color: AppColors.textMuted),
      onTap: () async {
        Navigator.pop(ctx);
        await onMarkInvited?.call(channel);
        onRefresh?.call();
      },
    );
  }

  void _showRsvpSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _RsvpSheet(
          guest: guest,
          onRecordRsvp: onRecordRsvp,
          onRefresh: onRefresh),
    );
  }

  Widget _sheetHandle() {
    return Center(
      child: Container(
        width: 36,
        height: 4,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
            color: AppColors.border,
            borderRadius: BorderRadius.circular(2)),
      ),
    );
  }
}

// ── More-actions overflow menu ─────────────────────────────────

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
      icon: const Icon(Icons.more_vert_rounded,
          size: 20, color: AppColors.textMuted),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: const BorderSide(color: AppColors.border)),
      color: AppColors.surface,
      elevation: 0,
      itemBuilder: (_) => [
        if (onEdit != null)
          const PopupMenuItem(
              value: 'edit',
              child: _MenuItem(icon: Icons.edit_outlined, label: 'Edit guest')),
        if (onMarkUninvited != null)
          const PopupMenuItem(
              value: 'uninvite',
              child: _MenuItem(
                  icon: Icons.remove_circle_outline_rounded,
                  label: 'Mark uninvited')),
        if (onCommsHistory != null)
          const PopupMenuItem(
              value: 'history',
              child: _MenuItem(
                  icon: Icons.history_rounded,
                  label: 'Communication history')),
        if (onDelete != null)
          const PopupMenuItem(
              value: 'delete',
              child: _MenuItem(
                  icon: Icons.delete_outline_rounded,
                  label: 'Delete guest',
                  danger: true)),
      ],
      onSelected: (value) async {
        switch (value) {
          case 'edit':
            onEdit?.call();
          case 'uninvite':
            await onMarkUninvited?.call();
            onRefresh?.call();
          case 'history':
            if (onCommsHistory != null && context.mounted) {
              _showCommsHistory(context);
            }
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
        content: Text(
            'Remove "${guest.guestName}" from this event? This can be undone on the web.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
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
  const _MenuItem(
      {required this.icon, required this.label, this.danger = false});
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
        Text(label,
            style: TextStyle(fontSize: 14, color: color)),
      ],
    );
  }
}

// ── Status badge ───────────────────────────────────────────────

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
      GuestStatus.invited => ('Invited', AppColors.invitedBg, AppColors.invitedText),
      GuestStatus.notInvited => ('Not invited', AppColors.notInvitedBg, AppColors.notInvited),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Text(label,
          style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: fg,
              letterSpacing: 0.2)),
    );
  }
}

// ── Action button ──────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  const _ActionButton({
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
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
            Text(label,
                style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: color)),
          ],
        ),
      ),
    );
  }
}

// ── RSVP sheet ─────────────────────────────────────────────────

class _RsvpSheet extends StatefulWidget {
  const _RsvpSheet(
      {required this.guest, this.onRecordRsvp, this.onRefresh});
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
    _count = widget.guest.attendingCount ??
        widget.guest.totalCount.clamp(1, widget.guest.maxGuests);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          Text('Record RSVP — ${widget.guest.guestName}',
              style: AppTextStyles.titleSmall),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _ToggleButton(
                  label: 'Attending',
                  selected: _attending,
                  color: AppColors.attending,
                  onTap: () => setState(() => _attending = true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ToggleButton(
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
            const Text('Number attending',
                style:
                    TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            Row(
              children: [
                _CountBtn(
                  icon: Icons.remove,
                  onTap: () => setState(() => _count =
                      (_count - 1).clamp(1, widget.guest.maxGuests)),
                ),
                const SizedBox(width: 20),
                Text('$_count',
                    style: const TextStyle(
                        fontSize: 24, fontWeight: FontWeight.w700)),
                const SizedBox(width: 20),
                _CountBtn(
                  icon: Icons.add,
                  onTap: () => setState(() => _count =
                      (_count + 1).clamp(1, widget.guest.maxGuests)),
                ),
                const SizedBox(width: 12),
                Text('of ${widget.guest.maxGuests} max',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textMuted)),
              ],
            ),
          ],
          const SizedBox(height: 24),
          // Primary gradient button
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
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppColors.brandMid, Color(0xFF302216)],
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Center(
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.textInverse),
                        )
                      : const Text('Save RSVP',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textInverse)),
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
      await widget.onRecordRsvp
          ?.call(_attending, count: _attending ? _count : null);
      if (mounted) Navigator.pop(context);
      widget.onRefresh?.call();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _ToggleButton extends StatelessWidget {
  const _ToggleButton(
      {required this.label,
      required this.selected,
      required this.color,
      required this.onTap});
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
          color: selected ? color : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(
              color: selected ? color : AppColors.border,
              width: selected ? 1.5 : 1),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : AppColors.textSecondary,
            ),
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
        width: 36,
        height: 36,
        decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, size: 18, color: AppColors.textPrimary),
      ),
    );
  }
}

// ── Communication history sheet ────────────────────────────────

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
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Column(
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Icon(Icons.history_rounded,
                        size: 18, color: AppColors.textSecondary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('History — ${widget.guestName}',
                          style: AppTextStyles.titleSmall),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: AppColors.borderLight),
          Expanded(
            child: FutureBuilder<List<CommunicationLog>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.brandAccent, strokeWidth: 2),
                  );
                }
                if (snap.hasError || snap.data == null) {
                  return const Center(
                    child: Text('Could not load history.',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 14)),
                  );
                }
                final logs = snap.data!;
                if (logs.isEmpty) {
                  return const Center(
                    child: Text('No communication history yet.',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 14)),
                  );
                }
                return ListView.separated(
                  controller: widget.scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  itemCount: logs.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, color: AppColors.borderLight),
                  itemBuilder: (_, i) => _LogRow(log: logs[i]),
                );
              },
            ),
          ),
        ],
      ),
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
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(7),
            ),
            child: Icon(_channelIcon(log.channel),
                size: 14, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(log.label,
                    style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary)),
                if (log.detail != null)
                  Text(log.detail!,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                const SizedBox(height: 3),
                Text(
                  '${DateFormat('d MMM yyyy · h:mm a').format(log.createdAt.toLocal())}'
                  '${log.actorName != null ? ' · ${log.actorName}' : ''}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _channelIcon(String channel) {
    switch (channel) {
      case 'whatsapp':
        return Icons.chat_rounded;
      case 'email':
        return Icons.email_outlined;
      case 'imessage':
        return Icons.message_rounded;
      default:
        return Icons.person_rounded;
    }
  }
}
