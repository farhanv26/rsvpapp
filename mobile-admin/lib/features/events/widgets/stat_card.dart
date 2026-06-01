import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.sub,
    this.color,
    this.colorBg,
    this.icon,
    this.progress,
    this.onTap,
  });

  final String label;
  final String value;
  final String? sub;
  final Color? color;
  final Color? colorBg;
  final IconData? icon;
  final double? progress;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final valueColor = color ?? AppColors.textPrimary;
    // Use explicit bg colour when provided, otherwise derive a light tint.
    // 0.13 alpha is intentionally stronger than before for visibility on cream.
    final accentBg = colorBg ?? (color != null
        ? color!.withValues(alpha: 0.13)
        : AppColors.surfaceMuted);
    final tappable = onTap != null;

    final card = Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: tappable && color != null ? color!.withValues(alpha: 0.3) : AppColors.border,
        ),
        boxShadow: AppShadows.card,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              color: accentBg,
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 15, color: valueColor.withValues(alpha: 0.55)),
                    const SizedBox(height: 6),
                  ],
                  Text(
                    value,
                    style: AppTextStyles.statValue.copyWith(color: valueColor),
                  ),
                  const SizedBox(height: 3),
                  Text(label.toUpperCase(), style: AppTextStyles.statLabel),
                  if (sub != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      sub!,
                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted, height: 1.3),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (progress != null)
            SizedBox(
              height: 3,
              child: LinearProgressIndicator(
                value: progress!.clamp(0.0, 1.0),
                backgroundColor: valueColor.withValues(alpha: 0.1),
                valueColor: AlwaysStoppedAnimation(valueColor.withValues(alpha: 0.6)),
              ),
            )
          else
            SizedBox(
              height: tappable ? 3 : 1,
              child: tappable
                  ? Container(color: valueColor.withValues(alpha: 0.18))
                  : null,
            ),
        ],
      ),
    );

    if (!tappable) return card;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: card,
      ),
    );
  }
}

class StatRow extends StatelessWidget {
  const StatRow({
    super.key,
    required this.label,
    required this.value,
    this.highlight = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool highlight;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: valueColor ?? (highlight ? AppColors.brandAccent : AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class SectionStatRow extends StatelessWidget {
  const SectionStatRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.color,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textSecondary;
    final tappable = onTap != null;

    final row = Padding(
      padding: EdgeInsets.symmetric(vertical: tappable ? 9 : 10),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 15, color: c),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
            ),
          ),
          Text(
            value,
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c),
          ),
          if (tappable) ...[
            const SizedBox(width: 6),
            Icon(Icons.chevron_right_rounded, size: 15, color: c.withValues(alpha: 0.5)),
          ],
        ],
      ),
    );

    if (!tappable) return row;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: row,
      ),
    );
  }
}
