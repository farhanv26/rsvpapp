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
  });

  final String eventId;
  final String eventTitle;

  @override
  ConsumerState<GuestsListScreen> createState() => _GuestsListScreenState();
}

class _GuestsListScreenState extends ConsumerState<GuestsListScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  String _statusFilter = 'all';
  String _readiness = 'all';
  bool _followup = false;
  String _duplicate = 'all';
  String _sort = 'name_asc';

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

  void _clearAllFilters() => setState(() {
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
          _clearAllFilters();
          Navigator.pop(ctx);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final guestsAsync = ref.watch(guestsListProvider(_params));
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
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
            icon: const Icon(Icons.person_add_outlined),
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
                icon: const Icon(Icons.tune_rounded),
                tooltip: 'Filters & sort',
                onPressed: _openFilterSheet,
              ),
              if (_hasActiveFilters)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(color: AppColors.brandAccent, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(100),
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
                      child: _Chip(label: f.$2, selected: selected, onTap: () => setState(() => _statusFilter = f.$1)),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
      ),
      body: guestsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.brandAccent)),
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
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceCard,
                  border: Border(bottom: BorderSide(color: AppColors.border.withValues(alpha: 0.8))),
                  boxShadow: AppShadows.card,
                ),
                child: Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      '${guests.length} shown',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                    ),
                    _SummaryPill(color: AppColors.attending, label: '$attending attending'),
                    _SummaryPill(color: AppColors.declined, label: '$declined declined'),
                    if (pending > 0) _SummaryPill(color: AppColors.pending, label: '$pending awaiting'),
                  ],
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.brandAccent,
                  backgroundColor: AppColors.surfaceCard,
                  onRefresh: () async => ref.invalidate(guestsListProvider(_params)),
                  child: ListView.separated(
                    padding: EdgeInsets.fromLTRB(12, 12, 12, 80 + bottomInset),
                    itemCount: guests.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final guest = guests[i];
                      final service = ref.read(guestsServiceProvider);
                      return GuestTile(
                        guest: guest,
                        eventId: widget.eventId,
                        onMarkInvited: (channel) =>
                            service.markInvited(widget.eventId, guest.id, channel: channel),
                        onMarkUninvited: () => service.markUninvited(widget.eventId, guest.id),
                        onRecordRsvp: (attending, {count}) => service.recordRsvp(
                          widget.eventId,
                          guest.id,
                          attending: attending,
                          attendingCount: count,
                        ),
                        onDelete: () => service.deleteGuest(widget.eventId, guest.id),
                        onGetCommsHistory: () =>
                            service.getCommunicationHistory(widget.eventId, guest.id),
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

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

/// Scrollable filters with safe area, reset, apply, and drag-to-dismiss.
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
                    tooltip: 'Close',
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
                    child: const Text('Reset all'),
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
                    _filterChipWrap([
                      ('all', 'All', _readiness == 'all'),
                      ('ready', 'Ready to send', _readiness == 'ready'),
                      ('missing_contact', 'Missing contact', _readiness == 'missing_contact'),
                      ('already_invited', 'Already invited', _readiness == 'already_invited'),
                      ('responded', 'Responded', _readiness == 'responded'),
                    ], (v) => setState(() => _readiness = v)),
                    const SizedBox(height: 18),
                    const Text('SPECIAL', style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 8),
                    _filterChipWrap([
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
                    const Text('SORT', style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 8),
                    _filterChipWrap([
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
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: () => widget.onApply(_readiness, _followup, _duplicate, _sort),
                        child: const Text('Apply'),
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

  Widget _filterChipWrap(List<(String, String, bool)> items, void Function(String) onSelect) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items
          .map(
            (item) => _FilterChip(
              label: item.$2,
              selected: item.$3,
              onTap: () => onSelect(item.$1),
            ),
          )
          .toList(),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? AppColors.brandAccentLight : AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(color: selected ? AppColors.brandAccent : AppColors.border),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? AppColors.brandMid : AppColors.textSecondary,
            ),
          ),
        ),
      ),
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
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandAccent : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: selected ? AppColors.brandAccent : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? AppColors.textOnAccent : AppColors.textSecondary,
            letterSpacing: 0.1,
          ),
        ),
      ),
    );
  }
}
