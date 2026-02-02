{{- define "logradar.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "logradar.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "logradar.labels" -}}
app.kubernetes.io/name: {{ include "logradar.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "logradar.selectorLabels" -}}
app.kubernetes.io/name: {{ include "logradar.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
