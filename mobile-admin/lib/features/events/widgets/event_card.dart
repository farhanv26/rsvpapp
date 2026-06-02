import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../../../core/models/event.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/utils/resolve_image_url.dart';

class EventCard extends ConsumerWidget {
  const EventCard({super.key, required this.event, required this.onTap});

  final Event event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final baseUrl = ref.watch(apiClientProvider).baseUrl;
    final imageUrl = (event.imagePath?.isNotEmpty == true)
        ? resolvePublicImageUrl(baseUrl, event.imagePath)
        : null;
    final deadline = _deadlineInfo(event.rsvpDeadline);

    return Container(
      // White card on cream background — clear visual separation
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3F2F1F).withValues(alpha: 0.08),
            offset: const Offset(0, 2),
            blurRadius: 12,
            spreadRadius: -2,
          ),
          BoxShadow(
            color: const Color(0xFF3F2F1F).withValues(alpha: 0.04),
            offset: const Offset(0, 1),
            blurRadius: 4,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          splashColor: AppColors.brandAccent.withValues(alpha: 0.06),
          highlightColor: AppColors.brandAccent.withValues(alpha: 0.04),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Image OR left-accent strip ──
              if (imageUrl != null)
                _ImageBanner(imageUrl: imageUrl)
              else
                Container(
                  height: 5,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFFC9A050), Color(0xFFB28944)],
                    ),
                  ),
                ),

              // ── Body ────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Badges
                    Wrap(
                      spacing: 7,
                      runSpacing: 6,
                      children: [
                        _Pill(
                          label: '${event.familyCount} ${event.familyCount == 1 ? 'family' : 'families'}',
                          fg: AppColors.textSecondary,
                          bg: AppColors.surfaceMuted,
                          border: AppColors.border,
                        ),
                        if (deadline != null)
                          _Pill(
                            label: deadline.label,
                            fg: deadline.fg,
                            bg: deadline.bg,
                            border: deadline.fg.withValues(alpha: 0.3),
                          ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Title
                    Text(
                      event.displayName,
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1D1B18),
                        letterSpacing: -0.3,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    // Subtitle
                    if (event.coupleNames != null &&
                        event.coupleNames!.isNotEmpty &&
                        event.coupleNames != event.title) ...[
                      const SizedBox(height: 3),
                      Text(
                        event.title,
                        style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],

                    // Date + Venue
                    const SizedBox(height: 12),
                    if (event.eventDate != null)
                      _MetaRow(
                        icon: Icons.calendar_today_outlined,
                        text: DateFormat('EEE, d MMM yyyy').format(event.eventDate!) +
                            (event.eventTime != null ? ' · ${event.eventTime}' : ''),
                      ),
                    if (event.venue != null) ...[
                      const SizedBox(height: 5),
                      _MetaRow(icon: Icons.location_on_outlined, text: event.venue!),
                    ],
                    if (event.eventDate == null && event.venue == null)
                      const Text(
                        'Date and venue not set.',
                        style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                      ),

                    // Confirmed-guests progress bar
                    if (event.totalHeadcount > 0) ...[
                      const SizedBox(height: 16),
                      _ProgressSection(event: event),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  _DeadlineInfo? _deadlineInfo(DateTime? deadline) {
    if (deadline == null) return null;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dl = DateTime(deadline.year, deadline.month, deadline.day);
    final diff = dl.difference(today).inDays;
    if (diff < 0) {
      return const _DeadlineInfo('RSVP Closed', Color(0xFF71717A), Color(0xFFF4F4F5));
    }
    if (diff == 0) {
      return const _DeadlineInfo('Closes Today', AppColors.danger, AppColors.dangerBg);
    }
    if (diff <= 7) {
      return const _DeadlineInfo('Closing Soon', AppColors.warning, AppColors.warningBg);
    }
    return const _DeadlineInfo('Open', AppColors.attending, AppColors.attendingBg);
  }
}

// ── Image banner ──────────────────────────────────────────────────

class _ImageBanner extends StatelessWidget {
  const _ImageBanner({required this.imageUrl});
  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      color: const Color(0xFFF7F2EA),
      child: Image.network(
        imageUrl,
        width: double.infinity,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
        loadingBuilder: (_, child, p) =>
            p == null ? child : const ColoredBox(color: Color(0xFFF7F2EA)),
        errorBuilder: (_, __, ___) => const ColoredBox(
          color: Color(0xFFF7F2EA),
          child: Center(
            child: Icon(Icons.photo_outlined, size: 28, color: AppColors.textMuted),
          ),
        ),
      ),
    );
  }
}

// ── Meta row ─────────────────────────────────────────────────────

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 12, color: AppColors.textMuted),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.35,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ── Progress section: confirmed headcount / total headcount ───────

class _ProgressSection extends StatelessWidget {
  const _ProgressSection({required this.event});
  final Event event;

  @override
  Widget build(BuildContext context) {
    final confirmed = event.confirmedAttendees;
    final total = event.totalHeadcount;
    final pct = total > 0 ? (confirmed / total).clamp(0.0, 1.0) : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label + count
        Row(
          children: [
            const Text(
              'Confirmed guests',
              style: TextStyle(
                fontSize: 11.5,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            Text(
              '$confirmed of $total',
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),
        // Progress bar
        ClipRRect(
          borderRadius: BorderRadius.circular(100),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 6,
            backgroundColor: const Color(0xFFECE5D6),
            valueColor: const AlwaysStoppedAnimation(AppColors.brandAccent),
          ),
        ),
        // Attending + Pending inline
        if (event.attendingFamilies > 0 || event.pendingFamilies > 0) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              if (event.attendingFamilies > 0)
                _StatChip(
                  label: '${event.attendingFamilies} attending',
                  color: AppColors.attending,
                  bg: AppColors.attendingBg,
                ),
              if (event.pendingFamilies > 0)
                _StatChip(
                  label: '${event.pendingFamilies} awaiting',
                  color: AppColors.pending,
                  bg: AppColors.pendingBg,
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.color, required this.bg});
  final String label;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
        ),
      );
}

// ── Pill badge ────────────────────────────────────────────────────

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.fg,
    required this.bg,
    required this.border,
  });
  final String label;
  final Color fg;
  final Color bg;
  final Color border;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(color: border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: fg,
            letterSpacing: 0.1,
          ),
        ),
      );
}

// ── Deadline info value object ────────────────────────────────────

class _DeadlineInfo {
  const _DeadlineInfo(this.label, this.fg, this.bg);
  final String label;
  final Color fg;
  final Color bg;
}
