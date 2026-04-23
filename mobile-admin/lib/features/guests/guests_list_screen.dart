import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/guests_service.dart';
import '../../shared/theme/app_theme.dart';
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
  bool _showFilters = false;

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
      _statusFilter != 'all' ||
      _readiness != 'all' ||
      _followup ||
      _duplicate != 'all' ||
      _sort != 'name_asc';

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

  @override
  Widget build(BuildContext context) {
    final guestsAsync = ref.watch(guestsListProvider(_params));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.eventTitle, style: AppTextStyles.titleMedium),
            const Text('Guest list',
                style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          // Add guest
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: 'Add guest',
            onPressed: () async {
              final added = await Navigator.push<bool>(
                context,
                MaterialPageRoute(
                  builder: (_) => GuestEditScreen(
                    eventId: widget.eventId,
                    guest: null,
                  ),
                ),
              );
              if (added == true) {
                ref.invalidate(guestsListProvider(_params));
              }
            },
          ),
          // Filters toggle
          Stack(
            alignment: Alignment.topRight,
            children: [
              IconButton(
                icon: const Icon(Icons.tune_rounded),
                tooltip: 'Filters & sort',
                onPressed: () =>
                    setState(() => _showFilters = !_showFilters),
              ),
              if (_hasActiveFilters)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    width: 8,
                    height: 8,
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
          preferredSize: Size.fromHeight(_showFilters ? 200 : 104),
          child: Column(
            children: [
              // Search bar
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (v) =>
                      setState(() => _query = v.trim()),
                  decoration: InputDecoration(
                    hintText: 'Search by name, phone, or email…',
                    prefixIcon:
                        const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: _query.isNotEmpty
                        ? IconButton(
                            icon:
                                const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _query = '');
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    isDense: true,
                  ),
                ),
              ),
              // Status filter chips
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                  children: _statusFilters.map((f) {
                    final selected = _statusFilter == f.$1;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _FilterChip(
                        label: f.$2,
                        selected: selected,
                        onTap: () =>
                            setState(() => _statusFilter = f.$1),
                      ),
                    );
                  }).toList(),
                ),
              ),

              // Expanded filters panel
              if (_showFilters)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                  decoration: const BoxDecoration(
                    color: AppColors.surfaceMuted,
                    border: Border(
                        top: BorderSide(color: AppColors.borderLight)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text('READINESS',
                              style: AppTextStyles.sectionLabel),
                          const Spacer(),
                          if (_hasActiveFilters)
                            GestureDetector(
                              onTap: _clearFilters,
                              child: const Text('Clear all',
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: AppColors.brandAccent,
                                      fontWeight: FontWeight.w600)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      _chipRow([
                        ('all', 'All', _readiness == 'all'),
                        ('ready', 'Ready to send', _readiness == 'ready'),
                        ('missing_contact', 'Missing contact',
                            _readiness == 'missing_contact'),
                        ('already_invited', 'Already invited',
                            _readiness == 'already_invited'),
                        ('responded', 'Responded', _readiness == 'responded'),
                      ], (v) => setState(() => _readiness = v)),
                      const SizedBox(height: 10),
                      const Text('SPECIAL FILTERS',
                          style: AppTextStyles.sectionLabel),
                      const SizedBox(height: 6),
                      _chipRow([
                        ('__followup__', 'Follow-up needed', _followup),
                        ('all_dup', 'All duplicates', _duplicate == 'has_duplicates'),
                        ('strong_dup', 'Strong duplicates',
                            _duplicate == 'strong'),
                      ], (v) {
                        setState(() {
                          if (v == '__followup__') {
                            _followup = !_followup;
                          } else if (v == 'all_dup') {
                            _duplicate = _duplicate == 'has_duplicates'
                                ? 'all'
                                : 'has_duplicates';
                          } else if (v == 'strong_dup') {
                            _duplicate = _duplicate == 'strong' ? 'all' : 'strong';
                          }
                        });
                      }),
                      const SizedBox(height: 10),
                      const Text('SORT', style: AppTextStyles.sectionLabel),
                      const SizedBox(height: 6),
                      _chipRow([
                        ('name_asc', 'Name A–Z', _sort == 'name_asc'),
                        ('name_desc', 'Name Z–A', _sort == 'name_desc'),
                        ('status', 'Status', _sort == 'status'),
                        ('last_action', 'Last action', _sort == 'last_action'),
                      ], (v) => setState(() => _sort = v)),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
      body: guestsAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.brandAccent)),
        error: (e, _) => ErrorView(
          message: e
              .toString()
              .replaceFirst('ApiException', '')
              .replaceAll(':', '')
              .trim(),
          onRetry: () => ref.invalidate(guestsListProvider(_params)),
        ),
        data: (guests) {
          if (guests.isEmpty) {
            return EmptyState(
              icon: Icons.person_search_rounded,
              title: _query.isNotEmpty || _hasActiveFilters
                  ? 'No matches'
                  : 'No guests yet',
              subtitle: _query.isNotEmpty || _hasActiveFilters
                  ? 'Try a different search or filter.'
                  : 'Add guests via the web or tap + above.',
            );
          }

          return Column(
            children: [
              // Summary bar
              Container(
                color: AppColors.surface,
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    Text(
                      '${guests.length} guest${guests.length == 1 ? '' : 's'}',
                      style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500),
                    ),
                    const Spacer(),
                    Text(
                      '${guests.where((g) => g.attending == true).length} attending',
                      style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.attending,
                          fontWeight: FontWeight.w600),
                    ),
                    const Text(' · ',
                        style: TextStyle(color: AppColors.textMuted)),
                    Text(
                      '${guests.where((g) => g.attending == false).length} declined',
                      style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.declined,
                          fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.border),

              Expanded(
                child: RefreshIndicator(
                  color: AppColors.brandAccent,
                  onRefresh: () async =>
                      ref.invalidate(guestsListProvider(_params)),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 48),
                    itemCount: guests.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final guest = guests[i];
                      final service = ref.read(guestsServiceProvider);
                      return GuestTile(
                        guest: guest,
                        eventId: widget.eventId,
                        onMarkInvited: (channel) =>
                            service.markInvited(widget.eventId, guest.id,
                                channel: channel),
                        onMarkUninvited: () =>
                            service.markUninvited(widget.eventId, guest.id),
                        onRecordRsvp: (attending, {count}) =>
                            service.recordRsvp(
                          widget.eventId,
                          guest.id,
                          attending: attending,
                          attendingCount: count,
                        ),
                        onDelete: () =>
                            service.deleteGuest(widget.eventId, guest.id),
                        onGetCommsHistory: () =>
                            service.getCommunicationHistory(
                                widget.eventId, guest.id),
                        onEdit: () async {
                          final updated = await Navigator.push<bool>(
                            context,
                            MaterialPageRoute(
                              builder: (_) => GuestEditScreen(
                                eventId: widget.eventId,
                                guest: guest,
                              ),
                            ),
                          );
                          if (updated == true) {
                            ref.invalidate(guestsListProvider(_params));
                          }
                        },
                        onRefresh: () =>
                            ref.invalidate(guestsListProvider(_params)),
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

  Widget _chipRow(
    List<(String, String, bool)> items,
    void Function(String) onSelect,
  ) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: items.map((item) {
        return _FilterChip(
          label: item.$2,
          selected: item.$3,
          onTap: () => onSelect(item.$1),
          small: true,
        );
      }).toList(),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.small = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: EdgeInsets.symmetric(
            horizontal: small ? 10 : 12, vertical: small ? 4 : 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandMid : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(
              color: selected ? AppColors.brandMid : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: small ? 11 : 12,
            fontWeight: FontWeight.w600,
            color:
                selected ? AppColors.textInverse : AppColors.textSecondary,
            letterSpacing: 0.1,
          ),
        ),
      ),
    );
  }
}
