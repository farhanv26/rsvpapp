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
    final dateLabel = _dateLabel(event.eventDate);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        splashColor: AppColors.brandAccent.withValues(alpha: 0.06),
        highlightColor: AppColors.brandAccent.withValues(alpha: 0.04),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
          ),
          child: hasImage
              ? _ImageCard(event: event, dateLabel: dateLabel)
              : _TextCard(event: event, dateLabel: dateLabel),
        ),
      ),
    );
  }

  (String, Color)? _dateLabel(DateTime? date) {
    if (date == null) return null;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final eventDay = DateTime(date.year, date.month, date.day);
    final diff = eventDay.difference(today).inDays;
    if (diff < 0) return ('Past', AppColors.textMuted);
    if (diff == 0) return ('Today', AppColors.danger);
    if (diff == 1) return ('Tomorrow', AppColors.warning);
    if (diff <= 7) return ('$diff days', AppColors.brandAccent);
    if (diff <= 30) return ('${(diff / 7).round()}w', AppColors.textSecondary);
    return null;
  }
}

// ── Image-based card ───────────────────────────────────────────────

class _ImageCard extends StatelessWidget {
  const _ImageCard({required this.event, required this.dateLabel});
  final Event event;
  final (String, Color)? dateLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Image with gradient overlay
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
                  errorBuilder: (_, __, ___) => _imageFallback(),
                  loadingBuilder: (_, child, progress) =>
                      progress == null ? child : _imageFallback(loading: true),
                ),
                // Bottom gradient for text legibility
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Color(0xCC0B0908)],
                      stops: [0.4, 1.0],
                    ),
                  ),
                ),
                // Date badge top-right
                if (dateLabel != null)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: _DateBadge(label: dateLabel!.$1, color: dateLabel!.$2),
                  ),
              ],
            ),
          ),
        ),
        _CardBody(event: event),
      ],
    );
  }

  Widget _imageFallback({bool loading = false}) {
    return Container(
      color: AppColors.surfaceElevated,
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
}

// ── Text-only card ─────────────────────────────────────────────────

class _TextCard extends StatelessWidget {
  const _TextCard({required this.event, required this.dateLabel});
  final Event event;
  final (String, Color)? dateLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Gold accent bar
        Container(
          width: 3,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.brandAccentBright, AppColors.brandMid],
            ),
            borderRadius: BorderRadius.horizontal(left: Radius.circular(AppRadius.lg)),
          ),
        ),
        Expanded(child: _CardBody(event: event, dateLabel: dateLabel)),
      ],
    );
  }
}

// ── Shared card body ───────────────────────────────────────────────

class _CardBody extends StatelessWidget {
  const _CardBody({required this.event, this.dateLabel});
  final Event event;
  final (String, Color)? dateLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(14),
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
              if (dateLabel != null) ...[
                const SizedBox(width: 8),
                _DateBadge(label: dateLabel!.$1, color: dateLabel!.$2),
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

// ── Meta chip ──────────────────────────────────────────────────────

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
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textMuted,
              fontWeight: FontWeight.w400,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Date badge ─────────────────────────────────────────────────────

class _DateBadge extends StatelessWidget {
  const _DateBadge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
