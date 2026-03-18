// ─── Level screen styles ─────────────────────────────────────────────────────

import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export function makeStyles(isDark: boolean) {
  const bg = isDark ? Colors.bgDark : Colors.bgLight;
  const text = isDark ? Colors.textOnDark : Colors.textPrimary;
  const sub = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;
  const cardBg = isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary;
  const border = isDark ? Colors.cellBorderDark : Colors.cellBorder;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: bg,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    hiddenInput: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },
    statusText: {
      fontSize: 16,
      color: text,
    },

    // ─── Top bar ────────────────────────────────────────────────────────
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 52,
      paddingBottom: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: {
      fontSize: 22,
      color: text,
    },
    levelTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: text,
      flex: 1,
      textAlign: 'center',
    },
    timer: {
      fontSize: 15,
      fontWeight: '600',
      color: sub,
      minWidth: 48,
      textAlign: 'right',
    },
    coinBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.coin,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginLeft: 8,
    },
    coinBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#5A4800',
    },
    sidebarToggleBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      borderRadius: 12,
      backgroundColor: cardBg,
    },
    sidebarToggleIcon: {
      fontSize: 22,
      color: text,
    },
    sidebarToggleIconProminent: {
      color: Colors.primary,
    },
    sidebarTooltip: {
      position: 'absolute',
      right: 56,
      top: 58,
      backgroundColor: cardBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
    },
    sidebarTooltipText: {
      fontSize: 12,
      fontWeight: '600',
      color: text,
    },

    // ─── Grid row (hint column + grid side by side) ─────────────────────
    gridRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
    },

    // ─── Hint column (left of grid) ─────────────────────────────────────
    hintColumn: {
      width: 50,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingLeft: 6,
    },

    // ─── Grid ───────────────────────────────────────────────────────────
    gridContainer: {
      flex: 1,
      alignItems: 'center',
      paddingRight: 6,
    },

    // ─── Active clue bar ────────────────────────────────────────────────
    activeClueBar: {
      backgroundColor: cardBg,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: border,
    },
    activeClueNumber: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    activeClueText: {
      fontSize: 14,
      color: text,
      lineHeight: 19,
    },

    // ─── Hint buttons (compact icon circles in the left column) ─────────
    hintBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#2a2756' : '#EEF0FF',
    },
    hintBtnDisabled: {
      opacity: 0.4,
    },
    hintBtnIcon: {
      fontSize: 18,
    },
    hintCoinBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: Colors.coin,
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 1,
      minWidth: 16,
      alignItems: 'center',
    },
    hintCoinText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#5A4800',
    },

    // ─── Hint modal ─────────────────────────────────────────────────────
    hintModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    hintModalCard: {
      width: '80%',
      backgroundColor: isDark ? Colors.bgDarkSecondary : '#FFFFFF',
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 10,
    },
    hintModalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: Colors.primary,
      marginBottom: 12,
    },
    hintModalBody: {
      fontSize: 15,
      color: text,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
    },
    hintModalClose: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 32,
    },
    hintModalCloseText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // ─── History panel ──────────────────────────────────────────────────
    historyPanel: {
      borderTopWidth: 1,
      borderTopColor: border,
      paddingTop: 6,
      paddingBottom: 8,
    },
    historyPanelVertical: {
      flex: 1,
      paddingTop: 0,
      paddingBottom: 16,
    },
    historyHeader: {
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 1,
      color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)',
      paddingHorizontal: 14,
      marginBottom: 4,
    },
    historyEmpty: {
      paddingHorizontal: 14,
    },
    historyEmptyText: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)',
    },
    historyContent: {
      paddingHorizontal: 12,
      gap: 6,
      alignItems: 'center',
    },
    historyContentVertical: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    historyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
    historyChipCorrect: {
      backgroundColor: isDark ? 'rgba(52,199,89,0.14)' : 'rgba(52,199,89,0.1)',
    },
    historyChipWrong: {
      backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.07)',
    },
    historyChipRef: {
      fontSize: 10,
      fontWeight: '600',
      color: sub,
      opacity: 0.7,
    },
    historyChipWord: {
      fontSize: 13,
      fontWeight: '600',
      color: text,
      letterSpacing: 0.5,
      opacity: 0.75,
    },
    historyChipWordWrong: {
      textDecorationLine: 'line-through',
      opacity: 0.4,
    },

    // ─── Sidebar backdrop ───────────────────────────────────────────────
    sidebarBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },

    // ─── Sidebar ────────────────────────────────────────────────────────
    sidebar: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: bg,
      borderLeftWidth: 1,
      borderLeftColor: border,
      shadowColor: '#000',
      shadowOffset: { width: -3, height: 0 },
      shadowOpacity: isDark ? 0.5 : 0.15,
      shadowRadius: 12,
      elevation: 16,
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    sidebarTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: sub,
    },
    sidebarCloseBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: cardBg,
    },
    sidebarCloseIcon: {
      fontSize: 14,
      color: text,
    },
  });
}

/** Sizing constants for WordPreview letter boxes (dynamic sizing uses these as bounds) */
export const PREVIEW_PADDING_H = 16;
export const PREVIEW_PADDING_V = 10;
export const PREVIEW_GAP = 8;
export const PREVIEW_BOX_MIN = 24;
export const PREVIEW_BOX_MAX = 50;
export const PREVIEW_BOX_DEFAULT = 44;
export const PREVIEW_BOX_HEIGHT_RATIO = 50 / 44; // original height/width

/** Fixed height for WordPreview container so clue length does not affect layout */
export const PREVIEW_CONTAINER_HEIGHT = 72;

export function makePreviewStyles(isDark: boolean) {
  const bg = isDark ? Colors.bgDark : '#F8F8FB';
  const border = isDark ? Colors.cellBorderDark : Colors.cellBorder;
  const letterColor = isDark ? Colors.textOnDark : Colors.textPrimary;

  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: PREVIEW_CONTAINER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'nowrap',
      paddingHorizontal: PREVIEW_PADDING_H,
      paddingVertical: PREVIEW_PADDING_V,
      gap: PREVIEW_GAP,
      backgroundColor: bg,
      borderTopWidth: 1,
      borderTopColor: border,
    },
    box: {
      borderRadius: 8,
      borderWidth: 2,
      borderColor: border,
      backgroundColor: isDark ? Colors.bgDarkSecondary : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxFilled: {
      backgroundColor: isDark ? '#2a2756' : '#EEF0FF',
      borderColor: Colors.primary,
    },
    boxCurrent: {
      borderColor: Colors.primary,
      borderWidth: 2.5,
    },
    letter: {
      fontWeight: '700',
      color: 'transparent',
    },
    letterFilled: {
      color: letterColor,
    },
  });
}

export type LevelScreenStyles = ReturnType<typeof makeStyles>;
export type WordPreviewStyles = ReturnType<typeof makePreviewStyles>;
