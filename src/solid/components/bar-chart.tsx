/** @jsxImportSource solid-js */
// Solid BarChart adapter - thin shell over `BarChartController`.
// Same prop surface and same canvas pixels as the React adapter.

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

import { type LineSeriesInput } from "../../domain"
import {
  type ThemeInput,
  type DigitGrouping,
  type NumberAbbreviation,
  type DecimalPlaces,
  type CurrencyDisplay,
  type PercentPrecision,
  type DateFormat,
  type TimeFormat,
  ChartFormatter,
  type Theme,
  type Palette,
  type LegendVisibility,
  type LegendPosition,
} from "../../personalization"
import { oklchToCssRgba } from "../../rendering/color-tables"
import {
  type YAxisPosition,
  type XAxisPosition,
} from "../../rendering/draw/axis"
import { type GridStyle } from "../../rendering/draw/grid"
import { type CrosshairMarker } from "../../rendering/draw/crosshair"
import { type Orientation } from "../../viewport/orientation"
import { type ValueLabels } from "../../personalization/axes/value-labels"
import { bisectNearest } from "../../shared/binary-search"
import { f64At } from "../../shared/typed"
import { useChartsContext } from "../charts-provider"
import {
  DefaultTooltip,
  type TooltipSeriesValue,
} from "../tooltips/default-tooltip"

import {
  BarChartController,
  type BarChartProviderSnapshot,
  type BarChartRenderContext,
} from "../../charts/bar-chart-controller"
import {
  type HoverState,
  SPARKLINE_THRESHOLD_PX,
} from "../../charts/bar-chart-helpers"

export type BarChartSeriesInput = LineSeriesInput

export interface BarSeriesConfig {
  readonly id: string
  readonly data: BarChartSeriesInput
  readonly label?: string
  readonly color?: string
}

export type BarGrouping = "clustered" | "stacked" | "normalized" | "overlapping"

export interface BarTooltipSeriesValue {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly value: number
}

export interface BarChartTooltipProps {
  readonly t: number
  readonly idx: number
  readonly seriesValues: readonly BarTooltipSeriesValue[]
  readonly pointerX: number
  readonly pointerY: number
  readonly containerWidth: number
  readonly containerHeight: number
  readonly theme: Theme
  readonly palette: Palette
  readonly locale: string
  readonly timeZone: string | undefined
  readonly formatter: ChartFormatter
}

export type BarChartTooltipProp =
  | undefined
  | false
  | ((props: BarChartTooltipProps) => JSX.Element)

export interface BarChartProps {
  data?: BarChartSeriesInput
  series?: readonly BarSeriesConfig[]
  grouping?: BarGrouping
  groupPadding?: number
  orientation?: Orientation
  valueLabels?: ValueLabels

  legend?: LegendVisibility
  legendPosition?: LegendPosition

  crosshairVisible?: boolean
  crosshairLineStyle?: GridStyle
  crosshairMarker?: CrosshairMarker
  tooltip?: BarChartTooltipProp

  width?: number
  height?: number
  theme?: ThemeInput
  palette?: string
  visualStyle?: "Fill" | "Outline"
  outlineFillColor?: "auto" | string
  outlineFillOpacity?: number
  pixelDensityCap?: number
  fastMode?: boolean
  sparkline?: boolean
  ariaLabel?: string

  axisVisible?: boolean
  yAxisPosition?: YAxisPosition
  xAxisPosition?: XAxisPosition
  yAxisPadding?: number
  gridVisible?: boolean
  gridStyle?: GridStyle
  gridDensity?: "sparse" | "normal" | "dense"
  accents?: boolean
  locale?: string
  timeZone?: string

  barWidthRatio?: number
  cornerRadius?: number
  borderWidth?: number

  digitGrouping?: DigitGrouping
  numberAbbreviation?: NumberAbbreviation
  decimalPlaces?: DecimalPlaces
  currency?: string
  currencyDisplay?: CurrencyDisplay
  percentPrecision?: PercentPrecision
  dateFormat?: DateFormat
  timeFormat?: TimeFormat
}

export function BarChart(props: BarChartProps): JSX.Element {
  const providerCtxAccessor = useChartsContext()
  let staticCanvasEl: HTMLCanvasElement | undefined
  let dynamicCanvasEl: HTMLCanvasElement | undefined
  let containerEl: HTMLDivElement | undefined
  let controller: BarChartController | null = null

  const [renderCtx, setRenderCtx] = createSignal<BarChartRenderContext | null>(
    null,
  )
  const [hover, setHover] = createSignal<HoverState | null>(null)

  const providerSnapshot = createMemo<BarChartProviderSnapshot>(() => {
    const v = providerCtxAccessor()
    return {
      theme: v.theme,
      palette: v.palette,
      locale: v.locale,
      timeZone: v.timeZone,
      visualStyle: v.visualStyle,
      outlineFillColor: v.outlineFillColor,
      outlineFillOpacity: v.outlineFillOpacity,
      cornerRadius: v.cornerRadius,
      borderWidth: v.borderWidth,
      accents: v.accents,
      osTheme: v.osTheme,
      appTheme: v.appTheme,
    }
  })

  onMount(() => {
    if (staticCanvasEl === undefined) return
    controller = new BarChartController({
      container: containerEl ?? null,
      staticCanvas: staticCanvasEl,
      dynamicCanvas: dynamicCanvasEl ?? null,
      initialProps: props,
      initialProvider: providerSnapshot(),
      onContextChange: setRenderCtx,
      onHoverChange: setHover,
    })
  })

  createEffect(() => {
    if (controller === null) return
    controller.update(props, providerSnapshot())
  })

  onCleanup(() => {
    if (controller !== null) {
      controller.dispose()
      controller = null
    }
  })

  const onPointerMove = (e: PointerEvent): void => {
    controller?.handlePointerMove(e)
  }
  const onPointerLeave = (): void => {
    controller?.handlePointerLeave()
  }

  const cssWidth = createMemo(() => props.width ?? 800)
  const cssHeight = createMemo(() => props.height ?? 300)
  const isSparkline = createMemo(
    () =>
      props.sparkline === true ||
      (props.sparkline !== false && cssWidth() < SPARKLINE_THRESHOLD_PX),
  )
  const ariaLabel = createMemo(
    () => props.ariaLabel ?? renderCtx()?.ariaLabel ?? "Bar chart",
  )

  const tooltipSeriesValues = createMemo<TooltipSeriesValue[]>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return []
    const out: TooltipSeriesValue[] = []
    const variantNow = ctx.personalization.palette[ctx.personalization.theme]
    const primaryColorResolved =
      ctx.primaryColor ??
      oklchToCssRgba(hv.value >= 0 ? variantNow.up : variantNow.down, 1)
    out.push({
      id: props.series?.[0]?.id ?? "primary",
      label: props.series?.[0]?.label ?? props.series?.[0]?.id ?? "Value",
      color: primaryColorResolved,
      value: hv.value,
    })
    for (let i = 0; i < ctx.secondarySeriesList.length; i++) {
      const sec = ctx.secondarySeriesList[i]!
      const propSec = props.series?.[i + 1]
      const secIdx =
        sec.ingested.length > 0 ? bisectNearest(sec.ingested.times, hv.t) : -1
      const secValue =
        secIdx >= 0 ? f64At(sec.ingested.values, secIdx) : Number.NaN
      out.push({
        id: propSec?.id ?? `series-${i + 1}`,
        label: propSec?.label ?? propSec?.id ?? `Series ${i + 2}`,
        color: sec.color,
        value: secValue,
      })
    }
    return out
  })

  const legendEntries = createMemo<
    ReadonlyArray<{ color: string; label: string }>
  >(() => {
    const ctx = renderCtx()
    if (ctx === null || props.series === undefined || props.series.length < 2)
      return []
    const variantNow = ctx.personalization.palette[ctx.personalization.theme]
    const out: { color: string; label: string }[] = []
    const s0 = props.series[0]!
    const primaryC = ctx.primaryColor ?? oklchToCssRgba(variantNow.up, 1)
    out.push({ color: primaryC, label: s0.label ?? s0.id })
    for (let i = 0; i < ctx.secondarySeriesList.length; i++) {
      const sec = ctx.secondarySeriesList[i]!
      const propSec = props.series[i + 1]!
      out.push({ color: sec.color, label: propSec.label ?? propSec.id })
    }
    return out
  })

  const legendNode = createMemo<JSX.Element>(() => {
    const ctx = renderCtx()
    const entries = legendEntries()
    if (ctx === null || entries.length === 0) return null
    const pers = ctx.personalization
    const legendVisibility = pers.legend
    const legendPos = pers.legendPosition
    if (legendVisibility === "off") return null
    const onHoverActive = legendVisibility === "on-hover" && hover() !== null
    if (legendVisibility !== "always" && !onHoverActive) return null
    const corner: JSX.CSSProperties = {
      position: "absolute",
      ...(legendPos === "top-left" || legendPos === "top-right"
        ? { top: "6px" }
        : { bottom: "6px" }),
      ...(legendPos === "top-left" || legendPos === "bottom-left"
        ? { left: "8px" }
        : { right: "8px" }),
      "pointer-events": "none",
      display: "flex",
      gap: "12px",
      "align-items": "center",
      padding: "4px 8px",
      background:
        pers.theme === "dark"
          ? "rgba(34,36,42,0.85)"
          : "rgba(255,255,255,0.85)",
      border: `1px solid ${pers.theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,18,23,0.08)"}`,
      "border-radius": "6px",
      "font-size": "11px",
      "font-family": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: pers.theme === "dark" ? "rgb(240,242,246)" : "rgb(20,22,26)",
    }
    return (
      <div style={corner} role="presentation">
        <For each={entries}>
          {(entry) => (
            <span
              style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "5px",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "10px",
                  height: "10px",
                  "border-radius": "2px",
                  background: entry.color,
                  display: "inline-block",
                  flex: "0 0 auto",
                }}
              />
              <span>{entry.label}</span>
            </span>
          )}
        </For>
      </div>
    )
  })

  const tooltipNode = createMemo<JSX.Element>(() => {
    const hv = hover()
    const ctx = renderCtx()
    if (hv === null || ctx === null) return null
    const tooltipProps: BarChartTooltipProps = {
      t: hv.t,
      idx: hv.idx,
      seriesValues: tooltipSeriesValues(),
      pointerX: hv.pointerX,
      pointerY: hv.pointerY,
      containerWidth: cssWidth(),
      containerHeight: cssHeight(),
      theme: ctx.personalization.theme,
      palette: ctx.personalization.palette,
      locale: ctx.resolvedLocaleBase,
      timeZone: ctx.resolvedTimeZone,
      formatter: ctx.formatter,
    }
    if (props.tooltip === false) return null
    if (typeof props.tooltip === "function") return props.tooltip(tooltipProps)
    return (
      <DefaultTooltip
        t={hv.t}
        value={hv.value}
        idx={hv.idx}
        seriesValues={tooltipSeriesValues()}
        pointerX={hv.pointerX}
        pointerY={hv.pointerY}
        containerWidth={cssWidth()}
        containerHeight={cssHeight()}
        theme={ctx.personalization.theme}
        palette={ctx.personalization.palette}
        locale={ctx.resolvedLocaleBase}
        timeZone={ctx.resolvedTimeZone}
        formatter={ctx.formatter}
      />
    )
  })

  return (
    <>
      {isSparkline() ? (
        <div
          style={{
            position: "relative",
            width: `${cssWidth()}px`,
            height: `${cssHeight()}px`,
          }}
          aria-label={ariaLabel()}
        >
          <canvas
            ref={(el) => (staticCanvasEl = el)}
            style={{
              display: "block",
              width: `${cssWidth()}px`,
              height: `${cssHeight()}px`,
            }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div
          ref={(el) => (containerEl = el)}
          style={{
            position: "relative",
            width: `${cssWidth()}px`,
            height: `${cssHeight()}px`,
          }}
          aria-label={ariaLabel()}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <canvas
            ref={(el) => (staticCanvasEl = el)}
            style={{
              display: "block",
              width: `${cssWidth()}px`,
              height: `${cssHeight()}px`,
            }}
            aria-hidden="true"
          />
          <canvas
            ref={(el) => (dynamicCanvasEl = el)}
            style={{
              display: "block",
              width: `${cssWidth()}px`,
              height: `${cssHeight()}px`,
              position: "absolute",
              inset: "0",
              "pointer-events": "none",
            }}
            aria-hidden="true"
          />
          {legendNode()}
          {tooltipNode()}
        </div>
      )}
    </>
  )
}
