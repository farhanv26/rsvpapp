import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/models/event.dart';
import '../../../shared/theme/app_theme.dart';

class EventCard extends StatelessWidget {
  const EventCard({super.key, required this.event, required this.onTap});

  final Event event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasImage = event.imagePath != null && event.imagePath!.isNotEmpty;
    final badge = _dateBadge(event.eventDate);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.card,
          ),
          child: hasImage
              ? _ImageCard(event: event, badge: badge)
              : _TextCard(event: event, badge: badge),
        ),
      ),
    );
  }

  _BadgeData? _dateBadge(DateTime? date) {
    if (date == null) return null;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final eventDay = DateTime(date.year, date.month, date.day);
    final diff = eventDay.difference(today).inDays;
    if (diff < 0) return const _BadgeData('Past', AppColors.textMuted, AppColors.surfaceMuted);
    if (diff == 0) return const _BadgeData('Today', AppColors.declined, AppColors.declinedBg);
    if (diff == 1) return const _BadgeData('Tomorrow', AppColors.pending, AppColors.pendingBg);
    if (diff <= 7) return _BadgeData('$diff days', AppColors.brandAccent, AppColors.brandAccentLight);
    if (diff <= 30) return _BadgeData('${(diff / 7).round()}w', AppColors.invited, AppColors.invitedBg);
    return null;
  }
}

class _BadgeData {
  const _BadgeData(this.label, this.fg, this.bg);
  final String label;
  final Color fg;
  final Color bg;
}

// ── Image card ─────────────────────────────────────────────────────

class _ImageCard extends StatelessWidget {
  const _ImageCard({required this.event, required this.badge});
  final Event event;
  final _BadgeData? badge;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
          child: AspectRatio(
            aspectRatio: 16 / 7,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.network(
                  event.imagePath!,
                  fit: BoxFit.cover,
                  filterQuality: FilterQuality.low,
                  cacheWidth: 1200,
                  errorBuilder: (_, __, ___) => _placeholder(),
                  loadingBuilder: (_, child, progress) =>
                      progress == null ? child : _placeholder(loading: true),
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, AppColors.brandDeep.withValues(alpha: 0.75)],
                      stops: const [0.4, 1.0],
                    ),
                  ),
                ),
                if (badge != null)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: _Badge(data: badge!),
                  ),
              ],
            ),
          ),
        ),
        _CardBody(event: event),
      ],
    );
  }

  Widget _placeholder({bool loading = false}) => Container(
        color: AppColors.surfaceMuted,
        child: Center(
          child: loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.brandAccent),
                )
              : const Icon(Icons.image_outlined, size: 28, color: AppColors.textMuted),
        ),
      );
}

// ── Text card ──────────────────────────────────────────────────────

class _TextCard extends StatelessWidget {
  const _TextCard({required this.event, required this.badge});
  final Event event;
  final _BadgeData? badge;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          width: 4,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.brandAccentBright, AppColors.brandAccent],
            ),
            borderRadius: BorderRadius.horizontal(left: Radius.circular(AppRadius.lg)),
          ),
        ),
        Expanded(child: _CardBody(event: event, badge: badge)),
      ],
    );
  }
}

// ── Shared card body ───────────────────────────────────────────────

class _CardBody extends StatelessWidget {
  const _CardBody({required this.event, this.badge});
  final Event event;
  final _BadgeData? badge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.displayName,
                      style: AppTextStyles.titleSmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (event.coupleNames != null &&
                        event.coupleNames!.isNotEmpty &&
                        event.title != event.displayName) ...[
                      const SizedBox(height: 2),
                      Text(
                        event.title,
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ],
                ),
              ),
              if (badge != null) ...[
                const SizedBox(width: 8),
                _Badge(data: badge!),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              _MetaChip(
                icon: Icons.people_outline_rounded,
                label: '${event.guestCount} guest${event.guestCount == 1 ? '' : 's'}',
              ),
              if (event.eventDate != null)
                _MetaChip(
                  icon: Icons.calendar_today_outlined,
                  label: DateFormat('d MMM yyyy').format(event.eventDate!),
                ),
              if (event.venue != null)
                _MetaChip(
                  icon: Icons.location_on_outlined,
                  label: event.venue!,
                  maxWidth: 140,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label, this.maxWidth});
  final IconData icon;
  final String label;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.textMuted),
        const SizedBox(width: 4),
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w400),
          ),
        ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.data});
  final _BadgeData data;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: data.bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: data.fg.withValues(alpha: 0.25)),
      ),
      child: Text(
        data.label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: data.fg, letterSpacing: 0.2),
      ),
    );
  }
}
