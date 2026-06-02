import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/guests_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';
import '../../shared/widgets/empty_state.dart';
import 'guest_edit_screen.dart';
import 'widgets/guest_tile.dart';

class GuestsListScreen extends ConsumerStatefulWidget {
  const GuestsListScreen({
    super.key,
    required this.eventId,
    required this.eventTitle,
    this.initialStatusFilter = 'all',
    this.initialReadiness = 'all',
    this.initialFollowup = false,
    this.initialDuplicate = 'all',
  });

  final String eventId;
  final String eventTitle;
  final String initialStatusFilter;
  final String initialReadiness;
  final bool initialFollowup;
  final String initialDuplicate;

  @override
  ConsumerState<GuestsListScreen> createState() => _GuestsListScreenState();
}

class _GuestsListScreenState extends ConsumerState<GuestsListScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  late String _statusFilter;
  late String _readiness;
  late bool _followup;
  String _duplicate = 'all';
  String _sort = 'name_asc';

  // Bulk selection
  bool _selectionMode = false;
  final Set<String> _selectedIds = {};

  void _enterSelectionMode(String firstId) => setState(() {
        _selectionMode = true;
        _selectedIds
          ..clear()
          ..add(firstId);
      });

  void _exitSelectionMode() => setState(() {
        _selectionMode = false;
        _selectedIds.clear();
      });

  void _toggleId(String id) => setState(() {
        if (_selectedIds.contains(id)) {
          _selectedIds.remove(id);
        } else {
          _selectedIds.add(id);
        }
      });

  void _selectAll(List<String> ids) => setState(() => _selectedIds.addAll(ids));

  Future<void> _bulkMarkInvited(BuildContext context, String channel) async {
    final ids = _selectedIds.toList();
    try {
      final n = await ref.read(guestsServiceProvider).bulkMarkInvited(widget.eventId, ids, channel: channel);
      _exitSelectionMode();
      ref.invalidate(guestsListProvider(_params));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$n guests marked as invited.')));
      }
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(userFacingErrorMessage(e))));
    }
  }

  Future<void> _bulkDelete(BuildContext context) async {
    final ids = _selectedIds.toList();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete guests?'),
        content: Text('Permanently remove ${ids.length} selected guest${ids.length == 1 ? '' : 's'}?'),
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
    if (confirmed != true || !context.mounted) return;
    try {
      final n = await ref.read(guestsServiceProvider).bulkDelete(widget.eventId, ids);
      _exitSelectionMode();
      ref.invalidate(guestsListProvider(_params));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$n guests deleted.')));
      }
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(userFacingErrorMessage(e))));
    }
  }

  @override
  void initState() {
    super.initState();
    _statusFilter = widget.initialStatusFilter;
    _readiness = widget.initialReadiness;
    _followup = widget.initialFollowup;
    _duplicate = widget.initialDuplicate;
  }

  static const _statusFilters = [
    ('all', 'All'),
    ('attending', 'Attending'),
    ('declined', 'Declined'),
    ('invited', 'Invited'),
    ('not_invited', 'Not invited'),
    ('pending', 'Pending'),
  ];

  GuestListParams get _params => GuestListParams(
        eventId: widget.eventId,
        query: _query,
        status: _statusFilter,
        readiness: _readiness,
        followup: _followup,
        duplicate: _duplicate,
        sort: _sort,
      );

  bool get _hasActiveFilters =>
      _statusFilter != 'all' || _readiness != 'all' || _followup || _duplicate != 'all' || _sort != 'name_asc';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _clearFilters() => setState(() {
        _statusFilter = 'all';
        _readiness = 'all';
        _followup = false;
        _duplicate = 'all';
        _sort = 'name_asc';
      });

  void _openFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: true,
      enableDrag: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _GuestFiltersSheet(
        initialReadiness: _readiness,
        initialFollowup: _followup,
        initialDuplicate: _duplicate,
        initialSort: _sort,
        onApply: (readiness, followup, duplicate, sort) {
          setState(() {
            _readiness = readiness;
            _followup = followup;
            _duplicate = duplicate;
            _sort = sort;
          });
          Navigator.pop(ctx);
        },
        onResetAll: () {
          _clearFilters();
          Navigator.pop(ctx);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final guestsAsync = ref.watch(guestsListProvider(_params));
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final allIds = guestsAsync.valueOrNull?.map((g) => g.id).toList() ?? [];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _selectionMode
          ? AppBar(
              backgroundColor: AppColors.background,
              leading: IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: _exitSelectionMode,
              ),
              title: Text(
                _selectedIds.isEmpty
                    ? 'Select guests'
                    : '${_selectedIds.length} selected',
                style: AppTextStyles.titleMedium,
              ),
              actions: [
                TextButton(
                  onPressed: allIds.isEmpty
                      ? null
                      : () => _selectedIds.length == allIds.length
                          ? setState(() => _selectedIds.clear())
                          : _selectAll(allIds),
                  child: Text(
                    _selectedIds.length == allIds.length ? 'Deselect all' : 'Select all',
                    style: const TextStyle(color: AppColors.brandAccent, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            )
          : AppBar(
              backgroundColor: AppColors.background,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.eventTitle, style: AppTextStyles.titleMedium),
                  const Text(
                    'Guest list',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.person_add_outlined, size: 21),
                  tooltip: 'Add guest',
                  onPressed: () async {
                    final added = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => GuestEditScreen(eventId: widget.eventId, guest: null),
                      ),
                    );
                    if (added == true) ref.invalidate(guestsListProvider(_params));
                  },
                ),
                Stack(
                  alignment: Alignment.topRight,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.tune_rounded, size: 21),
                      tooltip: 'Filters & sort',
                      onPressed: _openFilterSheet,
                    ),
                    if (_hasActiveFilters)
                      Positioned(
                        top: 10,
                        right: 10,
                        child: Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(
                            color: AppColors.brandAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(96),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (v) => setState(() => _query = v.trim()),
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Search name, phone, or email…',
                          prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textMuted),
                          suffixIcon: _query.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear_rounded, size: 18),
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    setState(() => _query = '');
                                  },
                                )
                              : null,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          isDense: true,
                        ),
                      ),
                    ),
                    SizedBox(
                      height: 40,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                        children: _statusFilters.map((f) {
                          final selected = _statusFilter == f.$1;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: _StatusChip(
                              label: f.$2,
                              selected: selected,
                              onTap: () => setState(() => _statusFilter = f.$1),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
      // ── Bulk action bar ──
      bottomSheet: _selectionMode && _selectedIds.isNotEmpty
          ? _BulkActionBar(
              count: _selectedIds.length,
              onMarkInvited: (channel) => _bulkMarkInvited(context, channel),
              onDelete: () => _bulkDelete(context),
            )
          : null,
      body: guestsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
        ),
        error: (e, _) => ErrorView(
          message: userFacingErrorMessage(e),
          onRetry: () => ref.invalidate(guestsListProvider(_params)),
        ),
        data: (guests) {
          if (guests.isEmpty) {
            return EmptyState(
              icon: Icons.person_search_rounded,
              title: _query.isNotEmpty || _hasActiveFilters ? 'No matches' : 'No guests yet',
              subtitle: _query.isNotEmpty || _hasActiveFilters
                  ? 'Try a different search or filter.'
                  : 'Tap + to add your first guest.',
            );
          }

          final attending = guests.where((g) => g.attending == true).length;
          final declined = guests.where((g) => g.attending == false).length;
          final pending = guests.where((g) => g.respondedAt == null && g.invitedAt != null).length;

          return Column(
            children: [
              // Summary bar
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceCard,
                  border: Border(bottom: BorderSide(color: AppColors.border.withValues(alpha: 0.8))),
                ),
                child: Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      '${guests.length} shown',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                    ),
                    _SummaryPill(color: AppColors.attending, label: '$attending attending'),
                    _SummaryPill(color: AppColors.declined, label: '$declined declined'),
                    if (pending > 0) _SummaryPill(color: AppColors.pending, label: '$pending awaiting'),
                    if (!_selectionMode)
                      GestureDetector(
                        onTap: () => guests.isNotEmpty ? _enterSelectionMode(guests.first.id) : null,
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.checklist_rounded, size: 12, color: AppColors.textMuted),
                            SizedBox(width: 3),
                            Text('Select', style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),

              Expanded(
                child: RefreshIndicator(
                  color: AppColors.brandAccent,
                  backgroundColor: AppColors.surfaceCard,
                  onRefresh: () async => ref.invalidate(guestsListProvider(_params)),
                  child: ListView.separated(
                    padding: EdgeInsets.fromLTRB(10, 8, 10, (_selectionMode ? 100 : 80) + bottomInset),
                    itemCount: guests.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 5),
                    itemBuilder: (context, i) {
                      final guest = guests[i];
                      final isSelected = _selectedIds.contains(guest.id);
                      final service = ref.read(guestsServiceProvider);

                      if (_selectionMode) {
                        return GestureDetector(
                          onTap: () => _toggleId(guest.id),
                          child: Stack(
                            children: [
                              Opacity(
                                opacity: isSelected ? 1.0 : 0.65,
                                child: GuestCompactRow(guest: guest, onTap: () => _toggleId(guest.id)),
                              ),
                              Positioned(
                                right: 12,
                                top: 0,
                                bottom: 0,
                                child: Center(
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 150),
                                    width: 22,
                                    height: 22,
                                    decoration: BoxDecoration(
                                      color: isSelected ? AppColors.brandDeep : AppColors.surfaceCard,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isSelected ? AppColors.brandDeep : AppColors.border,
                                        width: 2,
                                      ),
                                    ),
                                    child: isSelected
                                        ? const Icon(Icons.check_rounded, size: 13, color: AppColors.textInverse)
                                        : null,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }

                      return GuestCompactRow(
                        guest: guest,
                        onLongPress: () => _enterSelectionMode(guest.id),
                        onTap: () => showGuestDetailSheet(
                          context,
                          guest: guest,
                          eventId: widget.eventId,
                          onMarkInvited: (channel) => service.markInvited(widget.eventId, guest.id, channel: channel),
                          onMarkUninvited: () => service.markUninvited(widget.eventId, guest.id),
                          onRecordRsvp: (attending, {count}) => service.recordRsvp(
                            widget.eventId,
                            guest.id,
                            attending: attending,
                            attendingCount: count,
                          ),
                          onDelete: () => service.deleteGuest(widget.eventId, guest.id),
                          onGetCommsHistory: () => service.getCommunicationHistory(widget.eventId, guest.id),
                          onEdit: () async {
                            final updated = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => GuestEditScreen(eventId: widget.eventId, guest: guest),
                              ),
                            );
                            if (updated == true) ref.invalidate(guestsListProvider(_params));
                          },
                          onRefresh: () => ref.invalidate(guestsListProvider(_params)),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Bulk action bar ────────────────────────────────────────────────

class _BulkActionBar extends StatelessWidget {
  const _BulkActionBar({
    required this.count,
    required this.onMarkInvited,
    required this.onDelete,
  });
  final int count;
  final void Function(String channel) onMarkInvited;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.brandDeep,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$count guest${count == 1 ? '' : 's'} selected',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textInverse),
                ),
                const Text(
                  'Choose a bulk action',
                  style: TextStyle(fontSize: 11, color: AppColors.textInverse, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          _BulkBtn(
            icon: Icons.check_circle_outline_rounded,
            label: 'Mark invited',
            color: AppColors.attending,
            onTap: () => _showChannelPicker(context),
          ),
          const SizedBox(width: 8),
          _BulkBtn(
            icon: Icons.delete_outline_rounded,
            label: 'Delete',
            color: AppColors.danger,
            onTap: onDelete,
          ),
        ],
      ),
    );
  }

  void _showChannelPicker(BuildContext context) {
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
              Center(
                child: Container(
                  width: 36, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const Text('Mark invited via…', style: AppTextStyles.titleSmall),
              const SizedBox(height: 4),
              const Text('How did you reach them?', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              ...[
                (Icons.chat_rounded, 'WhatsApp', 'whatsapp', const Color(0xFF25D366)),
                (Icons.message_rounded, 'iMessage / SMS', 'imessage', AppColors.invited),
                (Icons.email_outlined, 'Email', 'email', AppColors.brandAccent),
                (Icons.person_rounded, 'In person / manual', 'manual', AppColors.textSecondary),
              ].map((t) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: t.$4.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: t.$4.withValues(alpha: 0.2)),
                  ),
                  child: Icon(t.$1, color: t.$4, size: 18),
                ),
                title: Text(t.$2, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
                onTap: () { Navigator.pop(ctx); onMarkInvited(t.$3); },
              )),
            ],
          ),
        ),
      ),
    );
  }
}

class _BulkBtn extends StatelessWidget {
  const _BulkBtn({required this.icon, required this.label, required this.color, required this.onTap});
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(height: 3),
              Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
            ],
          ),
        ),
      );
}

// ── Summary pill ───────────────────────────────────────────────────

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

// ── Filter bottom sheet ────────────────────────────────────────────

class _GuestFiltersSheet extends StatefulWidget {
  const _GuestFiltersSheet({
    required this.initialReadiness,
    required this.initialFollowup,
    required this.initialDuplicate,
    required this.initialSort,
    required this.onApply,
    required this.onResetAll,
  });

  final String initialReadiness;
  final bool initialFollowup;
  final String initialDuplicate;
  final String initialSort;
  final void Function(String readiness, bool followup, String duplicate, String sort) onApply;
  final VoidCallback onResetAll;

  @override
  State<_GuestFiltersSheet> createState() => _GuestFiltersSheetState();
}

class _GuestFiltersSheetState extends State<_GuestFiltersSheet> {
  late String _readiness;
  late bool _followup;
  late String _duplicate;
  late String _sort;

  @override
  void initState() {
    super.initState();
    _readiness = widget.initialReadiness;
    _followup = widget.initialFollowup;
    _duplicate = widget.initialDuplicate;
    _sort = widget.initialSort;
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final maxH = MediaQuery.sizeOf(context).height * 0.92;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: Container(
        constraints: BoxConstraints(maxHeight: maxH),
        margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.xxl),
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadows.cardLift,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 4, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    color: AppColors.textSecondary,
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Text(
                      'Filters & sort',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.titleMedium,
                    ),
                  ),
                  TextButton(
                    onPressed: widget.onResetAll,
                    child: const Text('Reset'),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('READINESS', style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 8),
                    _chips([
                      ('all', 'All', _readiness == 'all'),
                      ('ready', 'Ready to send', _readiness == 'ready'),
                      ('missing_contact', 'Missing contact', _readiness == 'missing_contact'),
                      ('already_invited', 'Already invited', _readiness == 'already_invited'),
                      ('responded', 'Responded', _readiness == 'responded'),
                    ], (v) => setState(() => _readiness = v)),
                    const SizedBox(height: 18),
                    const Text('SPECIAL', style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 8),
                    _chips([
                      ('__followup__', 'Follow-up only', _followup),
                      ('all_dup', 'Has duplicates', _duplicate == 'has_duplicates'),
                      ('strong_dup', 'Strong duplicates', _duplicate == 'strong'),
                    ], (v) {
                      setState(() {
                        if (v == '__followup__') {
                          _followup = !_followup;
                        } else if (v == 'all_dup') {
                          _duplicate = _duplicate == 'has_duplicates' ? 'all' : 'has_duplicates';
                        } else if (v == 'strong_dup') {
                          _duplicate = _duplicate == 'strong' ? 'all' : 'strong';
                        }
                      });
                    }),
                    const SizedBox(height: 18),
                    const Text('SORT BY', style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 8),
                    _chips([
                      ('name_asc', 'Name A–Z', _sort == 'name_asc'),
                      ('name_desc', 'Name Z–A', _sort == 'name_desc'),
                      ('status', 'By status', _sort == 'status'),
                      ('last_action', 'Last action', _sort == 'last_action'),
                    ], (v) => setState(() => _sort = v)),
                    SizedBox(height: MediaQuery.paddingOf(context).bottom + 8),
                  ],
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Close'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: () => widget.onApply(_readiness, _followup, _duplicate, _sort),
                        child: const Text('Apply filters'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chips(List<(String, String, bool)> items, void Function(String) onSelect) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((item) => _Chip(
        label: item.$2,
        selected: item.$3,
        onTap: () => onSelect(item.$1),
      )).toList(),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandDeep : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(
            color: selected ? AppColors.brandDeep : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? AppColors.textInverse : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ── Status chip (app bar bottom) ───────────────────────────────────

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandDeep : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: selected ? AppColors.brandDeep : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? AppColors.textInverse : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
