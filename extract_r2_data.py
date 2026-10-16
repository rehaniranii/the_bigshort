import json
import pandas as pd

p = '/Users/ronakshah07/.gemini/antigravity-ide/brain/327398dc-ed3d-440c-a68b-d015eb7a058c/.system_generated/logs/transcript_full.jsonl'
with open(p) as f:
    lines = f.readlines()

d = json.loads(lines[411])
content = d.get('content', '')
start_idx = content.find('timestamp,date,stock_id')
if start_idx != -1:
    csv_raw = content[start_idx:]
    # Check end of csv
    # It ends before any markdown image or artifact tag
    for em in ['\n[ARTIFACT', '\n![', '\n\n<', '\n```']:
        em_idx = csv_raw.find(em)
        if em_idx != -1:
            csv_raw = csv_raw[:em_idx]
    
    with open('/Users/ronakshah07/dz/round2_dataset.csv', 'w') as out:
        out.write(csv_raw.strip() + '\n')
    print('Saved /Users/ronakshah07/dz/round2_dataset.csv!')
    df = pd.read_csv('/Users/ronakshah07/dz/round2_dataset.csv')
    print('DF shape:', df.shape)
    print('DF columns:', df.columns.tolist())
    print('Row 800 to 805:\n', df.loc[799:804, ['timestamp', 'date', 'open', 'close', 'target']])
    print('Row 848 to 853:\n', df.loc[847:853, ['timestamp', 'date', 'open', 'close', 'target']])
    print('Row 895 to 899:\n', df.loc[895:899, ['timestamp', 'date', 'open', 'close', 'target']])
else:
    print('Header not found in line 411')
