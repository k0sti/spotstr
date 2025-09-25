import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

// Compact theme, mobile is main target platform - k0

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

const theme = extendTheme({
  config,
  // Reduce all spacing values for more compact UI
  space: {
    0: '0',
    0.5: '0.1rem',  // 1.6px
    1: '0.15rem',    // 2.4px (was 0.25rem/4px)
    1.5: '0.25rem',  // 4px
    2: '0.35rem',    // 5.6px (was 0.5rem/8px)
    3: '0.5rem',     // 8px (was 0.75rem/12px)
    4: '0.75rem',    // 12px (was 1rem/16px)
    5: '1rem',       // 16px (was 1.25rem/20px)
    6: '1.25rem',    // 20px (was 1.5rem/24px)
    7: '1.5rem',     // 24px (was 1.75rem/28px)
    8: '1.75rem',    // 28px (was 2rem/32px)
    9: '2rem',       // 32px (was 2.25rem/36px)
    10: '2.25rem',   // 36px (was 2.5rem/40px)
    12: '2.5rem',    // 40px (was 3rem/48px)
    14: '3rem',      // 48px (was 3.5rem/56px)
    16: '3.5rem',    // 56px (was 4rem/64px)
    20: '4rem',      // 64px (was 5rem/80px)
    24: '5rem',      // 80px (was 6rem/96px)
    28: '6rem',      // 96px (was 7rem/112px)
    32: '7rem',      // 112px (was 8rem/128px)
  },
  // Override component-specific sizes
  components: {
    Table: {
      sizes: {
        sm: {
          th: {
            px: '2',      // 5.6px padding
            py: '1.5',    // 4px padding
            fontSize: 'xs',
            lineHeight: 'short',
          },
          td: {
            px: '2',      // 5.6px padding
            py: '1.5',    // 4px padding
            fontSize: 'xs',
            lineHeight: 'short',
          },
          caption: {
            px: '2',
            py: '1.5',
            fontSize: 'xs',
          }
        },
        xs: {
          th: {
            px: '1.5',    // 4px padding
            py: '1',      // 2.4px padding
            fontSize: '2xs',
            lineHeight: 'shorter',
          },
          td: {
            px: '1.5',    // 4px padding
            py: '1',      // 2.4px padding
            fontSize: '2xs',
            lineHeight: 'shorter',
          },
          caption: {
            px: '1.5',
            py: '1',
            fontSize: '2xs',
          }
        }
      },
      defaultProps: {
        size: 'sm'  // Use small size by default
      }
    },
    Button: {
      sizes: {
        sm: {
          h: 7,           // 28px height
          minW: 7,
          px: 2,          // 5.6px padding
          fontSize: 'xs'
        },
        xs: {
          h: 6,           // 24px height
          minW: 6,
          px: 1.5,        // 4px padding
          fontSize: '2xs'
        }
      },
      defaultProps: {
        size: 'sm'  // Use small size by default
      }
    },
    IconButton: {
      sizes: {
        sm: {
          h: 7,
          minW: 7,
          fontSize: 'md'
        },
        xs: {
          h: 6,
          minW: 6,
          fontSize: 'sm'
        }
      },
      defaultProps: {
        size: 'sm'
      }
    },
    Badge: {
      sizes: {
        sm: {
          px: 1.5,
          py: 0.5,
          fontSize: '2xs'
        },
        xs: {
          px: 1,
          py: 0.5,
          fontSize: '2xs'
        }
      },
      defaultProps: {
        size: 'sm'
      }
    },
    Input: {
      sizes: {
        sm: {
          field: {
            px: 2,
            h: 8,
            fontSize: 'sm',
            borderRadius: 'sm',
          },
          addon: {
            px: 2,
            h: 8,
            fontSize: 'sm',
          }
        },
        xs: {
          field: {
            px: 1.5,
            h: 7,
            fontSize: 'xs',
            borderRadius: 'sm',
          },
          addon: {
            px: 1.5,
            h: 7,
            fontSize: 'xs',
          }
        }
      },
      defaultProps: {
        size: 'sm'
      }
    },
    Modal: {
      sizes: {
        sm: {
          dialog: {
            maxW: 'sm',
            mx: 2  // Smaller margin on mobile
          }
        }
      }
    },
    // Adjust Stack components default spacing
    Stack: {
      defaultProps: {
        spacing: 2  // Use smaller spacing by default
      }
    },
    HStack: {
      defaultProps: {
        spacing: 2
      }
    },
    VStack: {
      defaultProps: {
        spacing: 2
      }
    }
  },
  // Mobile-first responsive font sizes
  fontSizes: {
    '2xs': '0.625rem',  // 10px
    'xs': '0.7rem',     // 11.2px (was 0.75rem/12px)
    'sm': '0.8rem',     // 12.8px (was 0.875rem/14px)
    'md': '0.9rem',     // 14.4px (was 1rem/16px)
    'lg': '1rem',       // 16px (was 1.125rem/18px)
    'xl': '1.125rem',   // 18px (was 1.25rem/20px)
    '2xl': '1.25rem',   // 20px (was 1.5rem/24px)
    '3xl': '1.5rem',    // 24px (was 1.875rem/30px)
    '4xl': '1.875rem',  // 30px (was 2.25rem/36px)
    '5xl': '2.25rem',   // 36px (was 3rem/48px)
    '6xl': '3rem',      // 48px (was 3.75rem/60px)
    '7xl': '3.75rem',   // 60px (was 4.5rem/72px)
    '8xl': '4.5rem',    // 72px (was 6rem/96px)
    '9xl': '6rem',      // 96px (was 8rem/128px)
  },
  // Responsive breakpoints
  breakpoints: {
    base: '0px',
    sm: '480px',
    md: '768px',
    lg: '992px',
    xl: '1280px',
    '2xl': '1536px',
  },
  // Global styles for even more compact mobile view
  styles: {
    global: {
      'html, body': {
        fontSize: { base: '14px', md: '16px' },
      },
      // Additional mobile optimizations
      '@media (max-width: 480px)': {
        '.chakra-table': {
          fontSize: '0.7rem !important',
        },
        '.chakra-badge': {
          fontSize: '0.6rem !important',
          px: '1 !important',
          py: '0 !important',
        },
        '.chakra-button': {
          fontSize: '0.7rem !important',
        },
        '.chakra-modal__content': {
          mx: '2 !important',
          my: '4 !important',
        }
      }
    }
  }
})

export default theme