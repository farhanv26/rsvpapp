import 'package:flutter/material.dart';

/// Design tokens derived from the web app's globals.css.
/// Web brand: warm earthy cream/brown — NOT teal.
class AppColors {
  // Brand — warm brown (matches web --brand-deep + --brand-accent)
  static const brandDeep = Color(0xFF3F2F1F);
  static const brandMid = Color(0xFF4C3A26);
  static const brandAccent = Color(0xFFB28944);
  static const brandAccentLight = Color(0xFFF9F3E8);

  // Surfaces (matches web --background / --surface / --surface-muted)
  static const background = Color(0xFFF8F4EC);
  static const surface = Color(0xFFFFFDFA);
  static const surfaceMuted = Color(0xFFF6F1E8);
  static const surfaceCard = Color(0xFFFFFFFF);

  // Borders (matches web --border-soft)
  static const border = Color(0xFFE7DCCB);
  static const borderLight = Color(0xFFEADFCE);
  static const borderStrong = Color(0xFFDDCFBA);

  // Text (matches web --foreground)
  static const textPrimary = Color(0xFF1D1B18);
  static const textSecondary = Color(0xFF6A5434);
  static const textMuted = Color(0xFF9C8C7A);
  static const textInverse = Color(0xFFFFF8EE);

  // Status — matching web badge classes
  static const attending = Color(0xFF166534);     // emerald-900
  static const attendingBg = Color(0xFFDCFCE7);   // emerald-100
  static const attendingText = Color(0xFF166534);

  static const declined = Color(0xFF9F1239);      // rose-800
  static const declinedBg = Color(0xFFFFE4E6);    // rose-100
  static const declinedText = Color(0xFF9F1239);

  static const pending = Color(0xFF92400E);       // amber-900
  static const pendingBg = Color(0xFFFEF3C7);     // amber-100
  static const pendingText = Color(0xFF92400E);

  static const invited = Color(0xFF1E3A8A);       // blue-900 (badge-soft tone)
  static const invitedBg = Color(0xFFEFF6FF);
  static const invitedText = Color(0xFF1D4ED8);

  static const notInvited = Color(0xFF374151);
  static const notInvitedBg = Color(0xFFF3F4F6);

  // Utility
  static const danger = Color(0xFFB91C1C);
  static const dangerBg = Color(0xFFFEE2E2);
  static const warning = Color(0xFFB45309);
  static const warningBg = Color(0xFFFEF3C7);
  static const success = Color(0xFF15803D);
  static const successBg = Color(0xFFDCFCE7);
}

class AppTextStyles {
  static const sectionLabel = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.8,
    color: AppColors.textMuted,
    height: 1.0,
  );

  static const headlineDisplay = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    color: AppColors.textPrimary,
    height: 1.15,
  );

  static const titleLarge = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
    color: AppColors.textPrimary,
  );

  static const titleMedium = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    color: AppColors.textPrimary,
  );

  static const titleSmall = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.1,
    color: AppColors.textPrimary,
  );

  static const bodyMedium = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static const bodySmall = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  static const labelSmall = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.3,
    color: AppColors.textMuted,
  );

  static const statValue = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    color: AppColors.textPrimary,
    height: 1.0,
  );

  static const statLabel = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
    color: AppColors.textMuted,
    height: 1.2,
  );
}

class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  static const EdgeInsets screenPadding =
      EdgeInsets.symmetric(horizontal: 16, vertical: 0);
  static const EdgeInsets cardPadding = EdgeInsets.all(16);
  static const EdgeInsets sectionPadding =
      EdgeInsets.symmetric(horizontal: 16, vertical: 12);
}

class AppRadius {
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double xl = 22;
  static const double xxl = 28;
  static const double pill = 100;
}

class AppShadows {
  static List<BoxShadow> get card => [
        BoxShadow(
          color: const Color(0xFF47341D).withValues(alpha: 0.08),
          offset: const Offset(0, 4),
          blurRadius: 20,
          spreadRadius: -6,
        ),
      ];

  static List<BoxShadow> get cardLift => [
        BoxShadow(
          color: const Color(0xFF47341D).withValues(alpha: 0.12),
          offset: const Offset(0, 8),
          blurRadius: 32,
          spreadRadius: -8,
        ),
      ];
}

class AppTheme {
  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: const ColorScheme.light(
        primary: AppColors.brandMid,
        secondary: AppColors.brandAccent,
        surface: AppColors.surface,
        onPrimary: AppColors.textInverse,
        onSurface: AppColors.textPrimary,
        error: AppColors.danger,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: AppColors.border,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: AppColors.textSecondary),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: const BorderSide(color: AppColors.border, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.borderLight,
        thickness: 1,
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide:
              const BorderSide(color: AppColors.brandAccent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        hintStyle:
            const TextStyle(color: AppColors.textMuted, fontSize: 15),
        labelStyle:
            const TextStyle(color: AppColors.textSecondary, fontSize: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brandMid,
          foregroundColor: AppColors.textInverse,
          elevation: 0,
          shadowColor: Colors.transparent,
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg)),
          textStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.brandMid,
          side: const BorderSide(color: AppColors.borderStrong),
          minimumSize: const Size(double.infinity, 46),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg)),
          backgroundColor: AppColors.surface,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
            foregroundColor: AppColors.brandAccent,
            textStyle: const TextStyle(
                fontWeight: FontWeight.w600, letterSpacing: -0.1)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.brandAccentLight,
        selectedColor: AppColors.brandMid,
        labelStyle: const TextStyle(
            color: AppColors.brandMid,
            fontSize: 12,
            fontWeight: FontWeight.w600),
        secondaryLabelStyle: const TextStyle(
            color: AppColors.textInverse,
            fontSize: 12,
            fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        side: BorderSide.none,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.textPrimary,
        contentTextStyle:
            const TextStyle(color: Colors.white, fontSize: 14),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm)),
        behavior: SnackBarBehavior.floating,
        elevation: 0,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
        ),
        elevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xxl),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
    );
  }
}
