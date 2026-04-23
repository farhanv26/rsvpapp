import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/guest.dart';
import '../../../shared/theme/app_theme.dart';

class GuestTile extends StatelessWidget {
  const GuestTile({
    super.key,
    required this.guest,
    required this.eventId,
    this.onMarkInvited,
    this.onRecordRsvp,
    this.onRefresh,
  });

  final Guest guest;
  final String eventId;
  final Future<void> Function(String channel)? onMarkInvited;
  final Future<void> Function(bool attending, {int? count})? onRecordRsvp;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    final status = guest.status;
    final phone = guest.fullPhoneDigits;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name row + status badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      guest.guestName,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary, letterSpacing: -0.2),
                    ),
                    const SizedBox(height: 3),
                    Wrap(
                      spacing: 6,
                      children: [
                        _countChip('M ${guest.menCount}', Icons.man_rounded),
                        _countChip('W ${guest.womenCount}', Icons.woman_rounded),
                        if (guest.kidsCount > 0) _countChip('K ${guest.kidsCount}', Icons.child_care_rounded),
                        Text('· ${guest.totalCount} total', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _StatusBadge(status: status, attendingCount: guest.attendingCount),
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
                  _contactChip(Icons.phone_outlined, guest.phone!, onTap: () => _copyToClipboard(context, guest.phone!)),
                if (guest.email != null)
                  _contactChip(Icons.email_outlined, guest.email!, onTap: () => _copyToClipboard(context, guest.email!)),
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
                  Text('${guest.group}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                if (guest.tableName != null)
                  Text('Table: ${guest.tableName}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ],

          if (guest.invitedAt != null) ...[
            const SizedBox(height: 4),
            Text(
              'Invited ${DateFormat('d MMM').format(guest.invitedAt!)} via ${guest.inviteChannelLastUsed ?? 'manual'}'
              '${guest.inviteCount > 1 ? ' · ${guest.inviteCount}x' : ''}',
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],

          if (guest.hostMessage != null && guest.hostMessage!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.format_quote_rounded, size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Expanded(child: Text(guest.hostMessage!, style: const TextStyle(fontSize: 12, color: AppColors.primary, height: 1.4))),
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
              // WhatsApp
              if (phone.isNotEmpty)
                _ActionButton(
                  icon: Icons.chat_rounded,
                  label: 'WhatsApp',
                  color: const Color(0xFF25D366),
                  onTap: () => _openWhatsApp(phone, guest.greeting),
                ),
              // iMessage (iOS only, shows regardless since Flutter can try)
              if (phone.isNotEmpty)
                _ActionButton(
                  icon: Icons.message_rounded,
                  label: 'Message',
                  color: AppColors.invited,
                  onTap: () => _openSms(phone),
                ),
              // Mark invited
              if (guest.invitedAt == null && onMarkInvited != null)
                _ActionButton(
                  icon: Icons.check_circle_outline_rounded,
                  label: 'Mark invited',
                  color: AppColors.primary,
                  onTap: () => _showMarkInvitedDialog(context),
                ),
              // Record RSVP
              if (onRecordRsvp != null)
                _ActionButton(
                  icon: Icons.edit_note_rounded,
                  label: 'Record RSVP',
                  color: AppColors.accent,
                  onTap: () => _showRsvpDialog(context),
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
        Icon(icon, size: 11, color: AppColors.textSecondary),
        const SizedBox(width: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
      ],
    );
  }

  Widget _contactChip(IconData icon, String label, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  void _copyToClipboard(BuildContext context, String text) {
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

  void _showMarkInvitedDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mark "${guest.guestName}" as invited',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 4),
              const Text('How did you reach them?', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 20),
              _channelTile(ctx, Icons.chat_rounded, 'WhatsApp', 'whatsapp', const Color(0xFF25D366)),
              _channelTile(ctx, Icons.message_rounded, 'iMessage / SMS', 'imessage', AppColors.invited),
              _channelTile(ctx, Icons.email_outlined, 'Email', 'email', AppColors.accent),
              _channelTile(ctx, Icons.person_rounded, 'In person / manual', 'manual', AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }

  Widget _channelTile(BuildContext ctx, IconData icon, String label, String channel, Color color) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: color.withAlpha(25), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: color, size: 18),
      ),
      title: Text(label, style: const TextStyle(fontSize: 15)),
      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
      onTap: () async {
        Navigator.pop(ctx);
        await onMarkInvited?.call(channel);
        onRefresh?.call();
      },
    );
  }

  void _showRsvpDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _RsvpSheet(guest: guest, onRecordRsvp: onRecordRsvp, onRefresh: onRefresh),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, this.attendingCount});
  final GuestStatus status;
  final int? attendingCount;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (status) {
      GuestStatus.attending => ('Attending${attendingCount != null ? " ($attendingCount)" : ""}', AppColors.attendingBg, AppColors.attending),
      GuestStatus.declined => ('Declined', AppColors.declinedBg, AppColors.declined),
      GuestStatus.invited => ('Invited', AppColors.invitedBg, AppColors.invited),
      GuestStatus.notInvited => ('Not invited', AppColors.borderLight, AppColors.textSecondary),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.icon, required this.label, required this.color, required this.onTap});
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color.withAlpha(18),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withAlpha(60)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 5),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
          ],
        ),
      ),
    );
  }
}

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
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Record RSVP — ${widget.guest.guestName}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
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
            const Text('Number attending', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            Row(
              children: [
                _CountBtn(icon: Icons.remove, onTap: () => setState(() => _count = (_count - 1).clamp(1, widget.guest.maxGuests))),
                const SizedBox(width: 20),
                Text('$_count', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                const SizedBox(width: 20),
                _CountBtn(icon: Icons.add, onTap: () => setState(() => _count = (_count + 1).clamp(1, widget.guest.maxGuests))),
                const SizedBox(width: 12),
                Text('of ${widget.guest.maxGuests} max', style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
              ],
            ),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Save RSVP'),
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

class _ToggleButton extends StatelessWidget {
  const _ToggleButton({required this.label, required this.selected, required this.color, required this.onTap});
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
          color: selected ? color : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? color : AppColors.border, width: selected ? 1.5 : 1),
        ),
        child: Center(
          child: Text(label,
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
        width: 36, height: 36,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 18, color: AppColors.textPrimary),
      ),
    );
  }
}
