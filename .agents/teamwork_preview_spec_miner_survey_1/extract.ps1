Add-Type -AssemblyName System.IO.Compression.FileSystem
$docxPath = "c:\Users\Administrator\Desktop\telegram kripto oyunu\Project_Empire_Master_Blueprint_v1.0.docx"
$outPath = "c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1\blueprint_text.txt"

$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

# Extract paragraphs
$paragraphs = [regex]::Matches($xml, '<w:p[ >].*?</w:p>')
$lines = @()
foreach ($p in $paragraphs) {
    $text = [regex]::Replace($p.Value, '<[^>]+>', '')
    if ($text.Trim() -ne '') {
        $lines += $text
    }
}

$lines | Out-File -FilePath $outPath -Encoding utf8
Write-Host "Extracted $($lines.Count) lines to $outPath"
