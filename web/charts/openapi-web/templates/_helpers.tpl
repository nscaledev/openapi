{{- define "openapi-web.fullname" -}}
{{ .Chart.Name }}
{{- end -}}

{{- define "openapi-web.labels" -}}
app.kubernetes.io/name: {{ include "openapi-web.fullname" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
