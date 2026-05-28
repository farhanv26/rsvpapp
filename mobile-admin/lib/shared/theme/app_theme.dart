import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Modern navy + gold palette — premium event admin aesthetic.
class AppColors {
  // Surfaces
  static const background = Color(0xFFF5F6FB);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceCard = Color(0xFFFFFFFF);
  static const surfaceElevated = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF0F1F8);
  static const surfaceHighlight = Color(0xFFE6E9F5);

  // Borders
  static const border = Color(0xFFE2E5F0);
  static const borderLight = Color(0xFFEBEDF6);
  static const borderStrong = Color(0xFFC5CADF);

  // Text
  static const textPrimary = Color(0xFF1A1F3C);
  static const textSecondary = Color(0xFF6B7194);
  static const textMuted = Color(0xFF9B9FC0);
  static const textInverse = Color(0xFFFFFFFF);
  static const textOnAccent = Color(0xFF1A1F3C);

  // Brand (navy)
  static const brandDeep = Color(0xFF1A1F3C);
  static const brandMid = Color(0xFF2E3561);

  // Accent (gold)
  static const brandAccent = Color(0xFFF5A623);
  static const brandAccentBright = Color(0xFFF8B93D);
  static const brandAccentLight = Color(0xFFFFF8ED);

  // Status — Attending
  static const attending = Color(0xFF059669);
  static const attendingBg = Color(0xFFD1FAE5);
  static const attendingText = Color(0xFF059669);

  // Status — Declined
  static const declined = Color(0xFFDC2626);
  static const declinedBg = Color(0xFFFEE2E2);
  static const declinedText = Color(0xFFDC2626);

  // Status — Pending
  static const pending = Color(0xFFD97706);
  static const pendingBg = Color(0xFFFEF3C7);
  static const pendingText = Color(0xFFD97706);

  // Status — Invited
  static const invited = Color(0xFF3B82F6);
  static const invitedBg = Color(0xFFEFF6FF);
  static const invitedText = Color(0xFF3B82F6);

  // Status — Not invited
  static const notInvited = Color(0xFF9B9FC0);
  static const notInvitedBg = Color(0xFFF5F6FB);

  // Semantic
  static const danger = Color(0xFFDC2626);
  static const dangerBg = Color(0xFFFEE2E2);
  static const warning = Color(0xFFD97706);
  static const warningBg = Color(0xFFFEF3C7);
  static const success = Color(0xFF059669);
  static const successBg = Color(0xFFD1FAE5);
}

class AppTextStyles {
  static const sectionLabel = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.4,
    color: AppColors.textMuted,
    height: 1.0,
  );

  static const headlineDisplay = TextStyle(
    fontSize: 30,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.8,
    color: AppColors.textPrimary,
    height: 1.1,
  );

  static const titleLarge = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    color: AppColors.textPrimary,
  );

  static const titleMedium = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.3,
    color: AppColors.textPrimary,
  );

  static const titleSmall = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    color: AppColors.textPrimary,
  );

  static const bodyMedium = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
    height: 1.5,
  );

  static const bodySmall = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
    height: 1.4,
  );

  static const labelSmall = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.3,
    color: AppColors.textMuted,
  );

  static const statValue = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.8,
    color: AppColors.textPrimary,
    height: 1.0,
  );

  static const statLabel = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.6,
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

  static const EdgeInsets screenPadding = EdgeInsets.symmetric(horizontal: 16);
  static const EdgeInsets cardPadding = EdgeInsets.all(16);
  static const EdgeInsets sectionPadding = EdgeInsets.symmetric(horizontal: 16, vertical: 12);
}

class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double pill = 100;
}

class AppShadows {
  static List<BoxShadow> get card => [
        BoxShadow(
          color: AppColors.brandDeep.withValues(alpha: 0.05),
          offset: const Offset(0, 1),
          blurRadius: 8,
        ),
        BoxShadow(
          color: AppColors.brandDeep.withValues(alpha: 0.03),
          offset: const Offset(0, 4),
          blurRadius: 16,
          spreadRadius: -2,
        ),
      ];

  static List<BoxShadow> get cardLift => [
        BoxShadow(
          color: AppColors.brandDeep.withValues(alpha: 0.08),
          offset: const Offset(0, 4),
          blurRadius: 24,
          spreadRadius: -4,
        ),
      ];

  static List<BoxShadow> get button => [
        BoxShadow(
          color: AppColors.brandAccent.withValues(alpha: 0.3),
          offset: const Offset(0, 4),
          blurRadius: 16,
          spreadRadius: -4,
        ),
      ];

  static List<BoxShadow> get bottomNav => [
        BoxShadow(
          color: AppColors.brandDeep.withValues(alpha: 0.06),
          offset: const Offset(0, -1),
          blurRadius: 0,
        ),
      ];
}

class AppTheme {
  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      colorScheme: const ColorScheme.light(
        primary: AppColors.brandDeep,
        secondary: AppColors.brandAccent,
        surface: AppColors.surfaceCard,
        onPrimary: AppColors.textInverse,
        onSecondary: AppColors.textOnAccent,
        onSurface: AppColors.textPrimary,
        error: AppColors.danger,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.dark.copyWith(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
        ),
        titleTextStyle: AppTextStyles.titleMedium,
        iconTheme: const IconThemeData(color: AppColors.textSecondary, size: 22),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        height: 68,
        indicatorColor: AppColors.brandAccentLight,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.brandDeep,
              letterSpacing: 0.1,
            );
          }
          return const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: AppColors.textMuted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.brandDeep, size: 22);
          }
          return const IconThemeData(color: AppColors.textMuted, size: 22);
        }),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surfaceCard,
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
        fillColor: AppColors.surfaceElevated,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
          borderSide: const BorderSide(color: AppColors.brandDeep, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 15),
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
        floatingLabelStyle: const TextStyle(color: AppColors.brandDeep, fontSize: 13, fontWeight: FontWeight.w500),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brandAccent,
          foregroundColor: AppColors.textOnAccent,
          elevation: 0,
          shadowColor: Colors.transparent,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: -0.2),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: const BorderSide(color: AppColors.borderStrong),
          minimumSize: const Size(double.infinity, 46),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
          backgroundColor: AppColors.surfaceElevated,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.brandDeep,
          textStyle: const TextStyle(fontWeight: FontWeight.w600, letterSpacing: -0.1),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.brandAccent,
          foregroundColor: AppColors.textOnAccent,
          elevation: 0,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceMuted,
        selectedColor: AppColors.brandAccentLight,
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
        secondaryLabelStyle: const TextStyle(color: AppColors.brandDeep, fontSize: 12, fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        side: const BorderSide(color: AppColors.border),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.brandDeep,
        contentTextStyle: const TextStyle(color: AppColors.textInverse, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
        behavior: SnackBarBehavior.floating,
        elevation: 0,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
        ),
        elevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surfaceElevated,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xxl),
          side: const BorderSide(color: AppColors.border),
        ),
        titleTextStyle: AppTextStyles.titleMedium,
        contentTextStyle: AppTextStyles.bodySmall,
      ),
      iconTheme: const IconThemeData(color: AppColors.textSecondary),
      listTileTheme: const ListTileThemeData(
        tileColor: Colors.transparent,
        iconColor: AppColors.textSecondary,
        textColor: AppColors.textPrimary,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.brandAccent,
      ),
    );
  }
}
