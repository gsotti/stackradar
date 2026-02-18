{{- define "stats-collector.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "stats-collector.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "stats-collector.labels" -}}
app.kubernetes.io/name: {{ include "stats-collector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "stats-collector.selectorLabels" -}}
app.kubernetes.io/name: {{ include "stats-collector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
