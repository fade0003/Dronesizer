/**
 * Pareto scatter (SPEC §10): converged cases in instrument teal, the front
 * in rescue orange, invalid cases orange-outlined, lasso select enabled.
 * Lazy-loaded so Plotly stays out of the initial bundle (D30).
 */
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist-min';
import type { StudyCase } from '../../solver/studyRunner';

const Plot = createPlotlyComponent(Plotly);

interface TradeSpacePlotProps {
  cases: StudyCase[];
  paretoIndices: Set<number>;
  xKey: string;
  xLabel: string;
  yKey: string;
  yLabel: string;
  onSelectCase: (index: number | null) => void;
}

export default function TradeSpacePlot({
  cases, paretoIndices, xKey, xLabel, yKey, yLabel, onSelectCase,
}: TradeSpacePlotProps) {
  const converged = cases.filter(
    (c) => c.status === 'converged' && !paretoIndices.has(c.index),
  );
  const invalid = cases.filter((c) => c.status === 'invalid');
  const front = cases
    .filter((c) => paretoIndices.has(c.index))
    .sort((a, b) => (a.metrics[xKey] ?? 0) - (b.metrics[xKey] ?? 0));

  const pick = (list: StudyCase[], key: string) =>
    list.map((c) => c.metrics[key] ?? NaN);
  const indices = (list: StudyCase[]) => list.map((c) => c.index);

  return (
    <Plot
      data={[
        {
          x: pick(converged, xKey),
          y: pick(converged, yKey),
          customdata: indices(converged),
          mode: 'markers',
          type: 'scatter',
          name: 'converged',
          marker: { color: '#0B7285', size: 6, opacity: 0.65 },
        },
        {
          x: pick(invalid, xKey),
          y: pick(invalid, yKey),
          customdata: indices(invalid),
          mode: 'markers',
          type: 'scatter',
          name: 'invalid',
          marker: {
            color: 'rgba(0,0,0,0)',
            size: 7,
            line: { color: '#E8590C', width: 1.5 },
          },
        },
        {
          x: pick(front, xKey),
          y: pick(front, yKey),
          customdata: indices(front),
          mode: 'lines+markers',
          type: 'scatter',
          name: 'Pareto front',
          marker: { color: '#E8590C', size: 9 },
          line: { color: '#E8590C', width: 1.5 },
        },
      ]}
      layout={{
        autosize: true,
        height: 460,
        dragmode: 'lasso',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: '#FFFFFF',
        font: { family: 'Inter, system-ui, sans-serif', color: '#16212B', size: 12 },
        margin: { l: 60, r: 16, t: 16, b: 48 },
        xaxis: { title: { text: xLabel }, gridcolor: '#E4E9ED', zeroline: false },
        yaxis: { title: { text: yLabel }, gridcolor: '#E4E9ED', zeroline: false },
        legend: { orientation: 'h', y: 1.08 },
      }}
      config={{ displaylogo: false, responsive: true }}
      style={{ width: '100%' }}
      onClick={(event) => {
        const point = event.points?.[0];
        if (point?.customdata !== undefined) {
          onSelectCase(point.customdata as number);
        }
      }}
    />
  );
}
