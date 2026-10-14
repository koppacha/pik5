"""Render a standalone treasury figure with ReportLab's standard chart tools."""
import argparse
import json
import math
from pathlib import Path
from reportlab.graphics.shapes import Drawing, String, Rect, Line
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics import renderSVG
from reportlab.lib import colors

LABELS={
 'central_fixed_2x':'2x mean / fixed levy 1P',
 'central_1.5x_d15':'1.5x mean / deficit feedback',
 'central_1.75x_d15':'1.75x mean / deficit feedback',
 'central_2x_d15':'2x mean / deficit feedback',
 'central_3x_d15':'3x mean / deficit feedback',
}


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('input',type=Path)
 p.add_argument('output',type=Path)
 args=p.parse_args()
 x=json.loads(args.input.read_text())
 names=list(LABELS)
 width,height=960,540
 drawing=Drawing(width,height)
 drawing.add(Rect(0,0,width,height,fillColor=colors.white,strokeColor=None))
 drawing.add(String(70,505,'Central balance over the 48-hour tournament',fontName='Helvetica-Bold',fontSize=19))
 drawing.add(String(70,479,'20 independent seeds; lines are hourly means; initial balance 0P',fontSize=12))
 chart=LinePlot()
 chart.x=78;chart.y=120;chart.width=830;chart.height=330
 chart.data=[[(h,z) for h,z in enumerate(x['treasury_curves'][name]['mean'])] for name in names]
 chart.data.append([(0,0),(48,0)])
 chart.xValueAxis.valueMin=0;chart.xValueAxis.valueMax=48;chart.xValueAxis.valueSteps=list(range(0,49,6))
 chart.yValueAxis.valueMin=math.floor(min(v for series in chart.data for _,v in series)/50)*50
 chart.yValueAxis.valueMax=50
 chart.yValueAxis.valueSteps=list(range(chart.yValueAxis.valueMin,51,50))
 chart.yValueAxis.visibleGrid=True;chart.yValueAxis.gridStrokeColor=colors.HexColor('#e2e6ea')
 chart.xValueAxis.labels.fontSize=11;chart.yValueAxis.labels.fontSize=11
 palette=['#757575','#167153','#007e9e','#a15c13','#b43336']
 for i,c in enumerate(palette):
  chart.lines[i].strokeColor=colors.HexColor(c);chart.lines[i].strokeWidth=2.4
 chart.lines[0].strokeDashArray=[7,4]
 chart.lines[len(names)].strokeColor=colors.HexColor('#777777');chart.lines[len(names)].strokeWidth=.8
 drawing.add(chart)
 drawing.add(String(466,88,'Elapsed hours (48 = final collection at 47h59m)',fontSize=12,textAnchor='middle'))
 drawing.add(String(20,455,'P',fontSize=13))
 for i,name in enumerate(names):
  y=62-(i//3)*24;xpos=78+(i%3)*280
  drawing.add(Line(xpos,y+4,xpos+28,y+4,strokeColor=colors.HexColor(palette[i]),strokeWidth=2.4))
  drawing.add(String(xpos+34,y,LABELS[name],fontSize=10.5))
 renderSVG.drawToFile(drawing,str(args.output))
 svg=args.output.read_text().replace('<title>...</title>','<title>Central treasury balances, twenty seeded tournaments</title>').replace('<desc>...</desc>','<desc>Hourly mean Central balances comparing average-based tax borders and deficit feedback. Initial reserve is zero points.</desc>')
 args.output.write_text(svg)
 print('SVG figure generated')

if __name__=='__main__':main()
