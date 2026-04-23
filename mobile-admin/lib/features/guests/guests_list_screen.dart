import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/guests_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/empty_state.dart';
import 'widgets/guest_tile.dart';

class GuestsListScreen extends ConsumerStatefulWidget {
  const GuestsListScreen({super.key, required this.eventId, required this.eventTitle});

  final String eventId;
  final String eventTitle;

  @override
  ConsumerState<GuestsListScreen> createState() => _GuestsListScreenState();
}

class _GuestsListScreenState extends ConsumerState<GuestsListScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  String _statusFilter = 'all';

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
      );

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final guestsAsync = ref.watch(guestsListProvider(_params));

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Text(widget.eventTitle),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(104),
          child: Column(
            children: [
              // Search bar
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (v) => setState(() => _query = v.trim()),
                  decoration: InputDecoration(
                    hintText: 'Search by name, phone, or email…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
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
                      child: FilterChip(
                        label: Text(f.$2),
                        selected: selected,
                        onSelected: (_) => setState(() => _statusFilter = f.$1),
                        selectedColor: AppColors.primary,
                        backgroundColor: AppColors.surfaceCard,
                        labelStyle: TextStyle(
                          fontSize: 12,
                          color: selected ? Colors.white : AppColors.textSecondary,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                        ),
                        side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
                        showCheckmark: false,
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
      ),
      body: guestsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim(),
          onRetry: () => ref.invalidate(guestsListProvider(_params)),
        ),
        data: (guests) {
          if (guests.isEmpty) {
            return EmptyState(
              icon: Icons.person_search_rounded,
              title: _query.isNotEmpty || _statusFilter != 'all' ? 'No matches' : 'No guests yet',
              subtitle: _query.isNotEmpty || _statusFilter != 'all'
                  ? 'Try a different search or filter.'
                  : 'Add guests on the web to manage them here.',
            );
          }

          return Column(
            children: [
              // Summary bar
              Container(
                color: AppColors.surfaceCard,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    Text('${guests.length} guest${guests.length == 1 ? '' : 's'}',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                    const Spacer(),
                    Text(
                      '${guests.where((g) => g.attending == true).length} attending',
                      style: const TextStyle(fontSize: 13, color: AppColors.attending, fontWeight: FontWeight.w500),
                    ),
                    const Text(' · ', style: TextStyle(color: AppColors.textMuted)),
                    Text(
                      '${guests.where((g) => g.attending == false).length} declined',
                      style: const TextStyle(fontSize: 13, color: AppColors.declined, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.border),

              Expanded(
                child: RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async => ref.invalidate(guestsListProvider(_params)),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 40),
                    itemCount: guests.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final guest = guests[i];
                      final service = ref.read(guestsServiceProvider);
                      return GuestTile(
                        guest: guest,
                        eventId: widget.eventId,
                        onMarkInvited: (channel) => service.markInvited(widget.eventId, guest.id, channel: channel),
                        onRecordRsvp: (attending, {count}) => service.recordRsvp(
                          widget.eventId,
                          guest.id,
                          attending: attending,
                          attendingCount: count,
                        ),
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
