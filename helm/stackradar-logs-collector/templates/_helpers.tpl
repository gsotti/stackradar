{{- define "logs-collector.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "logs-collector.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "logs-collector.labels" -}}
app.kubernetes.io/name: {{ include "logs-collector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "logs-collector.selectorLabels" -}}
app.kubernetes.io/name: {{ include "logs-collector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
