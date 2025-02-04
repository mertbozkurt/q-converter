import React, { useState } from 'react';
import './App.css';
import Papa from 'papaparse';

function App() {
  const [fileContent, setFileContent] = useState(null);
  const [pisanoInput, setPisanoInput] = useState(null);
  const [pisanoToken, setPisanoToken] = useState('');
  const [pisanoAccount, setPisanoAccount] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [environment, setEnvironment] = useState('try');
  const [baseUrl, setBaseUrl] = useState('https://api.try.psn.cx');
  const [activeTab, setActiveTab] = useState('converter');
  const [csvData, setCsvData] = useState(null);
  const [mappingComplete, setMappingComplete] = useState(false);
  const [columnMapping, setColumnMapping] = useState({});
  const [availableQuestionKeys, setAvailableQuestionKeys] = useState([]);
  const [channelCreated, setChannelCreated] = useState(false);

  const environments = [
    { value: 'try', label: 'Try', url: 'https://api.try.psn.cx' },
    { value: 'stage', label: 'Stage', url: 'https://api.stage.psn.cx' },
    { value: 'prodtr', label: 'Production TR', url: 'https://api.pisano.com.tr' },
    { value: 'prodeu', label: 'Production EU', url: 'https://api.pisano.co' }
  ];

  const handleEnvironmentChange = (event) => {
    const selectedEnv = event.target.value;
    setEnvironment(selectedEnv);
    const envConfig = environments.find(env => env.value === selectedEnv);
    setBaseUrl(envConfig.url);
  };

  const handleFileRead = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const fileContent = e.target.result;
      const jsonObject = JSON.parse(fileContent);
      const pisanoInput = convertQSFtoPisano(fileContent);
      setPisanoInput(pisanoInput);
      setFileContent(jsonObject);
    };

    reader.readAsText(file);
  };

  const handlePisanoTokenChange = (event) => {
    setPisanoToken(event.target.value);
  };

  const handleSubmit = () => {
    if (!pisanoToken.trim()) {
      alert('Please enter a Pisano token');
      return;
    }

    fetch(`${baseUrl}/v1/complete_login?token=${pisanoToken}`, {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        setPisanoAccount(data);
        fetchLanguages();
      })
      .catch(error => {
        console.error('Error:', error);
      });
  };

  const handleCreate = async () => {
    const url = `${baseUrl}/v1/flows?node_id=${pisanoAccount.node.id}`;
    
    setProgress(25);
    setProgressStatus('Initializing flow creation...');
    
    try {
      setProgress(50);
      setProgressStatus('Sending flow data...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pisanoToken}`,
        },
        body: JSON.stringify(pisanoInput),
      });

      setProgress(75);
      setProgressStatus('Processing response...');

      if (response.ok) {
        const data = await response.json();
        pisanoInput.id = data.id;
        console.log('POST request successful!');
        
        // Extract question keys from pisanoInput
        const questionKeys = pisanoInput.states[0].elements
          .filter(element => element.type === 'question')
          .map(element => element.detail.key);
        
        setAvailableQuestionKeys(questionKeys);
        
        setProgress(100);
        setProgressStatus('Flow created successfully!');

        // Count questions by type
        const questionCounts = pisanoInput.states[0].elements.reduce((acc, element) => {
          if (element.type === 'question') {
            const style = element.detail.style;
            acc[style] = (acc[style] || 0) + 1;
          }
          return acc;
        }, {});

        // Create statistics message
        const statsMessage = Object.entries(questionCounts)
          .map(([type, count]) => `${type}: ${count}`)
          .join('\n');

        // Create custom alert dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
        `;

        dialog.innerHTML = `
          <h3 style="margin-top: 0;">Flow created successfully!</h3>
          <div style="margin: 10px 0;">
            <strong>Flow ID:</strong> 
            <span id="flowId">${data.id}</span>
            <button onclick="copyFlowId()" style="margin-left: 10px;">Copy ID</button>
            <a href="https://try.psn.cx/beta/dashboard/flows/${data.id}" target="_blank">
              <button style="margin-left: 10px;">View Flow</button>
            </a>
          </div>
          <div style="white-space: pre-line;">
            <strong>Question Statistics:</strong>\n${statsMessage}
          </div>
          <button onclick="closeDialog()" style="margin-top: 15px;">Close</button>
        `;

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 999;
        `;

        // Add copy and close functions
        window.copyFlowId = () => {
          navigator.clipboard.writeText(data.id)
            .then(() => alert('Flow ID copied to clipboard!'))
            .catch(err => console.error('Failed to copy:', err));
        };

        window.closeDialog = () => {
          document.body.removeChild(dialog);
          document.body.removeChild(overlay);
          delete window.copyFlowId;
          delete window.closeDialog;
        };

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
      } else {
        setProgress(0);
        setProgressStatus('Error creating flow');
        console.error('Error making POST request:', response.status);
        alert('Error creating flow. Please try again.');
      }
    } catch (error) {
      setProgress(0);
      setProgressStatus('Error creating flow');
      console.error('Error:', error);
      alert('Error creating flow. Please try again.');
    }
  };

  const handleDownload = () => {
    const fileName = 'pisanoInput.json';
    const jsonStr = JSON.stringify(pisanoInput, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleStatistics = () => {
    // Check if fileContent exists and has the expected structure
    if (!fileContent || !fileContent.SurveyElements) {
      alert('Please load a valid QSF file first');
      return;
    }

    const stats = {
      totalQuestions: 0,
      textEntryQuestions: 0,
      textEntryQuestionsSingleLine: 0,
      textEntryQuestionsMultiLine: 0,
      textEntryQuestionsEssayTextbox: 0,
      multipleChoiceQuestions: 0,
      singleChoiceQuestions: 0,
      matrixLikertQuestions: 0,
      formQuestions: 0,
      NPSQuestions: 0,
      textBlockQuestions: 0,
      graphicalBlockQuestions: 0,
      multipleSelectBoxQuestions: 0
    };

    // Get all survey elements that are questions
    const questions = fileContent.SurveyElements.filter(
      element => element.Element === "SQ"
    );

    stats.totalQuestions = questions.length;

    questions.forEach(question => {
      const questionType = question.Payload.QuestionType;
      const selector = question.Payload.Selector;

      switch(questionType) {
        case "TE": // Text Entry
          if (selector === "FORM") {
            stats.formQuestions++;
          } else if (selector === "SL") {
            stats.textEntryQuestionsSingleLine++;
          } else if (selector === "ML") {
            stats.textEntryQuestionsMultiLine++;
          } else if(selector === "ESTB") {
            stats.textEntryQuestionsEssayTextbox++;
          } else {
            stats.textEntryQuestions++;
          }
          break;
        case "MC": // Multiple Choice
          if (selector === "MAVR" || selector === "MACOL") {
            stats.multipleChoiceQuestions++;
          } else if (selector === "SAHR" || selector === "SACOL" ) {
            stats.singleChoiceQuestions++;
          }else if(selector === "NPS"){
            stats.NPSQuestions++;
          }else if(selector === "MSB"){
            stats.multipleSelectBoxQuestions++;
          }
          break;
        case "Matrix":
          if(selector === "Likert" ){
            stats.matrixLikertQuestions++;
          }
          break;
        case "DB":
          if(selector === "TB" ){
            stats.textBlockQuestions++;
          }
          else if(selector === "GRB"){
            stats.graphicalBlockQuestions++;
          }
          break;
        default:
          break; // Handle any other question types
      }
    });
    setFileContent(stats);
  };

  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${baseUrl}/v1/languages`, {
        headers: {
          'accept': 'application/json',
          'authorization': `Token token="${pisanoToken}"`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLanguages(data);
      } else {
        console.error('Failed to fetch languages:', response.status);
      }
    } catch (error) {
      console.error('Error fetching languages:', error);
    }
  };

  const handleCreateLinkCampaign = async () => {
    const campaignName = prompt("Please enter the campaign name:");
    if (!campaignName) return;

    try {
      const response = await fetch(`${baseUrl}/v1/link_campaigns`, {
        method: 'POST',
        headers: {
          'authorization': `Token token="${pisanoToken}"`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          operating_hours_attributes: [],
          unsubscribe_visible: true,
          timezone: "Istanbul",
          pisano_branding: true,
          send_emails_to_customers: false,
          name: campaignName,
          type: "Link",
          status: "active",
          parent_id: pisanoAccount.node.id,
          code: campaignName.toLowerCase().replace(/\s+/g, '-'),
          operating_24_7: true,
          customer_email_kind: "default"
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Assign flow to the newly created channel
        const assignResponse = await fetch(`${baseUrl}/v1/nodes/${data.id}/assign_flow`, {
          method: 'POST',
          headers: {
            'authorization': `Token token="${pisanoToken}"`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            id: data.id,
            flow_id: pisanoInput.id  // Assuming pisanoInput.id contains the flow ID
          })
        });

        if (assignResponse.ok) {
          setChannelCreated(true);
          // Store the channel ID in pisanoInput
          setPisanoInput(prev => ({
            ...prev,
            channelId: data.id
          }));
          // Create custom alert dialog for campaign creation
          const dialog = document.createElement('div');
          dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
          `;

          dialog.innerHTML = `
            <h3 style="margin-top: 0;">Link Campaign Created Successfully!</h3>
            <div style="margin: 10px 0;">
              <strong>Channel ID:</strong> 
              <span id="channelId">${data.id}</span>
              <button onclick="copyChannelId()" style="margin-left: 10px;">Copy ID</button>
            </div>
            <div style="margin: 10px 0;">
              <a href="https://web.${baseUrl.split('api.')[1]}/web_feedback?node_id=${data.id}" target="_blank">
                <button style="margin-left: 10px;">Open Survey</button>
              </a>
            </div>
            <button onclick="closeDialog()" style="margin-top: 15px;">Close</button>
          `;

          // Add overlay
          const overlay = document.createElement('div');
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
          `;

          // Add copy and close functions
          window.copyChannelId = () => {
            navigator.clipboard.writeText(data.id)
              .then(() => alert('Channel ID copied to clipboard!'))
              .catch(err => console.error('Failed to copy:', err));
          };

          window.closeDialog = () => {
            document.body.removeChild(dialog);
            document.body.removeChild(overlay);
            delete window.copyChannelId;
            delete window.closeDialog;
          };

          document.body.appendChild(overlay);
          document.body.appendChild(dialog);
        } else {
          alert('Campaign created but failed to assign flow');
          console.error('Error assigning flow:', assignResponse.status);
        }
      } else {
        alert('Failed to create link campaign');
        console.error('Error:', response.status);
      }
    } catch (error) {
      alert('Error in campaign creation process');
      console.error('Error:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const results = Papa.parse(text, { header: true });
        setCsvData(results.data);
        setColumnMapping({});
        setMappingComplete(false);
      };
      reader.readAsText(file);
    }
  };

  const handleMappingChange = (csvColumn, questionKey) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvColumn]: questionKey
    }));
  };

  const validateMapping = () => {
    // Add validation logic here
    setMappingComplete(true);
  };

  const generatePisanoCsv = () => {
    const mappedData = csvData.slice(2).map(row => {
      const newRow = {
        node_id: pisanoInput.channelId,
        flow_id: pisanoInput.id,
        language: fileContent.SurveyEntry.SurveyLanguage,
        customer_id: '',
        customer_name: '',
        customer_email: '',
        customer_phone_number: '',
      };

      Object.entries(columnMapping).forEach(([csvCol, pisanoKey]) => {
        newRow[pisanoKey] = row[csvCol];
      });

      return newRow;
    });

    const csv = Papa.unparse(mappedData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pisano-import.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Qualtrics Migration Tool</h1>
      </header>

      <main className="app-main">
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'converter' ? 'active' : ''}`}
            onClick={() => handleTabChange('converter')}
          >
            Flow Converter
          </button>
          <button 
            className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => channelCreated ? handleTabChange('import') : null}
            disabled={!channelCreated}
            title={!channelCreated ? "Create a link channel first" : ""}
          >
            Data Import
          </button>
        </div>

        {activeTab === 'converter' ? (
          <>
            <div className="token-section">
              <div className="input-group">
                <label htmlFor="environment">Environment:</label>
                <select
                  id="environment"
                  value={environment}
                  onChange={handleEnvironmentChange}
                  className="environment-select"
                >
                  {environments.map(env => (
                    <option key={env.value} value={env.value}>
                      {env.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="pisanoToken">Pisano Token:</label>
                <input
                  id="pisanoToken"
                  type="text"
                  value={pisanoToken}
                  onChange={handlePisanoTokenChange}
                  placeholder="Enter your Pisano token"
                />
                <button className="primary-button" onClick={handleSubmit}>
                  Validate Token
                </button>
              </div>
            </div>

            {pisanoAccount && pisanoAccount.account && (
              <div className="account-info">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Account:</span>
                    <span className="info-value">{pisanoAccount.account.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Node ID:</span>
                    <span className="info-value">{pisanoAccount.account.id}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Available Languages:</span>
                    <span className="info-value">{languages.length}</span>
                  </div>
                </div>
                
                <div className="file-upload">
                  <input type="file" accept=".qsf" onChange={handleFileRead} />
                </div>
              </div>
            )}

            {fileContent && (
              <div className="content-section">
                <div className="button-group">
                  <button className="secondary-button" onClick={handleDownload}>
                    Download Pisano Input
                  </button>
                  <button className="primary-button" onClick={handleCreate}>
                    Create Pisano Flow
                  </button>
                  <button className="secondary-button" onClick={handleStatistics}>
                    View Statistics
                  </button>
                  <button 
                    className="secondary-button" 
                    onClick={handleCreateLinkCampaign}
                    disabled={!pisanoInput?.id}
                  >
                    Create Link Campaign
                  </button>
                </div>

                {progress > 0 && (
                  <>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="progress-status">{progressStatus}</div>
                  </>
                )}

                <div className="json-preview">
                  <h2>File Content</h2>
                  
                  {/* Card preview visualization */}
                  <div className="card-preview">
                    
                    <div className="card-grid">
                      {Object.entries(fileContent).map(([key, value], index) => (
                        <div key={index} className="preview-card">
                          <div className="card-header">
                            <h4>{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                          </div>
                          <div className="card-body">
                            {key === 'SurveyElements' && Array.isArray(value) ? (
                              <div className="survey-elements">
                                {value.map((element, elemIndex) => (
                                  <details key={elemIndex} className="element-details">
                                    <summary className="element-summary">
                                      {element.Element} - {element.PrimaryAttribute || 'No Primary Attribute'}
                                    </summary>
                                    <div className="element-content">
                                      {Object.entries(element).map(([elemKey, elemValue]) => (
                                        <div key={elemKey} className="stat-item">
                                          <span className="stat-label">{elemKey}:</span>
                                          <span className="stat-value">
                                            {typeof elemValue === 'object' ? (
                                              <details className="nested-details">
                                                <summary>View Details</summary>
                                                <pre className="nested-json">
                                                  {JSON.stringify(elemValue, null, 2)}
                                                </pre>
                                              </details>
                                            ) : (
                                              String(elemValue)
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            ) : typeof value === 'object' && value !== null ? (
                              <div className="card-stats">
                                {Object.entries(value).map(([statKey, statValue], statIndex) => (
                                  <div key={statIndex} className="stat-item">
                                    <span className="stat-label">{statKey}:</span>
                                    <span className="stat-value">
                                      {typeof statValue === 'object' ? (
                                        <details className="nested-details">
                                          <summary>View Details</summary>
                                          <pre className="nested-json">
                                            {JSON.stringify(statValue, null, 2)}
                                          </pre>
                                        </details>
                                      ) : (
                                        String(statValue)
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="single-value">{String(value)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="import-section">
            <h2>Data Import</h2>
            
            <div className="import-steps">
              <div className="step-indicator">
                <div className={`step ${csvData ? 'completed' : 'active'}`}>1. Upload CSV</div>
                <div className={`step ${csvData ? (mappingComplete ? 'completed' : 'active') : ''}`}>
                  2. Map Fields
                </div>
                <div className={`step ${mappingComplete ? 'active' : ''}`}>3. Generate CSV</div>
              </div>

              {/* Step 1: File Upload */}
              <div className="upload-section">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="file-input"
                  id="csvFileInput"
                />
                <label htmlFor="csvFileInput" className="file-label">
                  <div className="upload-icon">
                    <i className="fas fa-cloud-upload-alt"></i>
                  </div>
                  <span>Choose a CSV file or drag it here</span>
                  <span className="file-hint">Only CSV files are accepted</span>
                </label>
              </div>

              {/* Step 2: Column Mapping */}
              {csvData && (
                <div className="mapping-section">
                  <h3>Map CSV Columns to Question Keys</h3>
                  <div className="mapping-grid">
                    {Object.keys(csvData[0] || {}).map((column) => (
                      <div key={column} className="mapping-item">
                        <div className="mapping-source">
                          <strong>CSV Column:</strong> {column}
                        </div>
                        <div className="mapping-arrow">↓</div>
                        <div className="mapping-target">
                          <select
                            value={columnMapping[column] || ''}
                            onChange={(e) => handleMappingChange(column, e.target.value)}
                            className="mapping-select"
                          >
                            <option value="">Select Question Key</option>
                            {availableQuestionKeys.sort().map((key) => (
                              <option key={key} value={key}>
                                {key}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="primary-button"
                    onClick={validateMapping}
                    disabled={!Object.keys(columnMapping).length}
                  >
                    Confirm Mapping
                  </button>
                </div>
              )}

              {/* Step 3: Generate CSV */}
              {mappingComplete && (
                <div className="generate-section">
                  <h3>Generate Pisano-Compatible CSV</h3>
                  <div className="preview-table">
                    {/* Preview of mapped data */}
                    <table>
                      <thead>
                        <tr>
                          {Object.values(columnMapping).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(2, 7).map((row, index) => (
                          <tr key={index}>
                            {Object.entries(columnMapping).map(([csvCol, pisanoKey]) => (
                              <td key={pisanoKey}>{row[csvCol]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="primary-button" onClick={generatePisanoCsv}>
                    Download Formatted CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );

  function convertQSFtoPisano(qsfFile) {
    const parsedQSF = JSON.parse(qsfFile);
    const surveyLanguage = parsedQSF.SurveyEntry.SurveyLanguage;
    
    // Add prompt for flow name
    const flowName = prompt("Please enter the flow name:", parsedQSF.SurveyEntry.SurveyName);
    if (!flowName) return; // Exit if user cancels

    const newFlow = {
      states: [
        {
          style: "plain",
          elements: [],
          key: "P1",
          initial: true
        }
      ],
      transitions: [],
      auto_translate: null,
      prevent_customer_comment_email: false,
      segment_ids: [],
      name: flowName, // Use the user-provided name instead
      parent_flow_id: null,
      parent_node_ids: [pisanoAccount.account.id],
      quota: null,
      chat_rating_enabled: false,
      quota_notify_emails: [
        ""
      ],
      is_conversational: false,
      prevent_multiple_feedback: false,
      chat_rating_setting: {
        active: false,
        body: {}
      },
      spam_filter_on: false,
      data_retention_settings: {},
      prevent_upload: false,
      language_ids: [
        languages.find(lang => lang.code === "EN")?.id,
        // Only add the survey language if it's different from English
        ...(surveyLanguage !== "EN" ? 
          [languages.find(lang => lang.code === surveyLanguage)?.id] : 
          []
        )
      ].filter(Boolean),
      default_language_id: languages.find(lang => lang.code === surveyLanguage)?.id
    };

    // Get all survey elements that are questions
    const questions = parsedQSF.SurveyElements.filter(
      element => element.Element === "SQ"
    );

    // Process each question
    questions.forEach((question, index) => {
      const questionType = question.Payload.QuestionType;
      const selector = question.Payload.Selector;
      debugger;
      // Handle Text Entry questions with Single Line selector
      if (questionType === "TE" && (selector === "SL" || selector === "ML" || selector === "ESTB")) {
        const shortTextQuestion = {
          type: "question",
          visible: true,
          detail: {
            required: question.Payload.Validation?.Settings?.RequireAnswer === "ON",
            extra: {
              spam_filter_on: true
            },
            style: selector === "ML" ? "textarea" : selector === "ESTB" ? "textarea" : "text",
            body: {
              [surveyLanguage]: question.Payload.QuestionText
            },
            key: question.Payload.QuestionID
          },
          key: `P1E${index + 1}`,
          triggers: null
        };

        newFlow.states[0].elements.push(shortTextQuestion);
      }
      else if(questionType === "MC" && (selector === "SAHR" || selector === "SACOL") ){
        debugger;
        const multipleChoiceQuestion = {
          type: "question",
          visible: true,
          detail: {
            required: false,
            style: "radio",
            extra: {
              layout: "horizontal"
            },
            body: {
              [surveyLanguage]: question.Payload.QuestionText
            },
            options: Object.entries(question.Payload.Choices).map(([choiceId, choice], index) => ({
              weight: 0,
              body: {
                [surveyLanguage]: choice.Display
              },
              order: index,
              key: choice.Display,
              // Add text entry field if TextEntry is "on"
              text_entry: choice.TextEntry === "on"
            })),
            key: question.Payload.QuestionID
          },
          key: `P1E${index + 1}`,
          triggers: null
        } ;
        newFlow.states[0].elements.push(multipleChoiceQuestion);
        }
        else if(questionType === "MC" && selector === "NPS"){
          const NPSQuestion = {
            type: "question",
            visible: true,
            detail: {
                required: false,
                style: "score",
                weight: 1,
                extra: {
                    has_static_options: true
                },
                body: {
                    [surveyLanguage]: question.Payload.QuestionText
                },
                options: [
                    {
                        weight: -1,
                        body: {
                            EN: "0"
                        },
                        defaultBody: "0",
                        key: "0",
                        order: 0,
                        description: {
                            "IR": "من توصیه نمی کنم",
                            "IT": "Non lo consiglio",
                            "AR": "أنا لا أوصي",
                            "ZH-HANS": "我不推荐",
                            "JA": "私はお勧めしません",
                            "ES-ES": "No lo recomendaría",
                            "KO": "나는 추천하지 않는다",
                            "EN": "I would not recommend",
                            "SQ": "Une nuk do te rekomandoja",
                            "SR": "Ne bih preporučio",
                            "RU": "Я не рекомендую",
                            "FR-CA": "Je ne recommanderais pas",
                            "TR": "Tavsiye etmem",
                            "ES": "No lo recomiendo",
                            "FR": "Je ne recommanderais pas",
                            "DE": "Ich empfehle nicht"
                        },
                        
                    },
                    {
                        weight: -1,
                        body: {
                            "EN": "1"
                        },
                        defaultBody: "1",
                        key: "1",
                        order: 1,
                    },
                    {
                        weight: -1,
                        body: {
                            "EN": "2"
                        },
                        defaultBody: "2",
                        key: "2",
                        order: 2
                        
                    },
                    {
                        weight: -1,
                        body: {
                            "EN": "3"
                        },
                        defaultBody: "3",
                        key: "3",
                        order: 3
                    },
                    {
                        weight: -1,
                        body: {
                            "EN": "4"
                        },
                        defaultBody: "4",
                        key: "4",
                        order: 4  
                    },
                    {
                        weight: -1,
                        body: {
                            "EN": "5"
                        },
                        defaultBody: "5",
                        key: "5",
                        order: 5
                        
                    },
                    {
                        weight: -1,
                        body: {
                            "EN": "6"
                        },
                        defaultBody: "6",
                        key: "6",
                        order: 6
                    },
                    {
                        weight: 0,
                        body: {
                            "EN": "7"
                        },
                        defaultBody: "7",
                        key: "7",
                        order: 7
                    },
                    {
                        weight: 0,
                        body: {
                            "EN": "8"
                        },
                        defaultBody: "8",
                        key: "8",
                        order: 8
                    },
                    {
                        weight: 1,
                        body: {
                            "EN": "9"
                        },
                        defaultBody: "9",
                        key: "9",
                        order: 9
                    },
                    {
                        weight: 1,
                        body: {
                            "EN": "10"
                        },
                        defaultBody: "10",
                        key: "10",
                        order: 10,
                        description: {
                            "IR": "ن توصیه میکنم",
                            "IT": "Io consiglio",
                            "AR": "نا أوصي",
                            "ZH-HANS": "我建议",
                            "JA": "私はアドバイスします",
                            "ES-ES": "Yo aconsejo",
                            "KO": "나는 충고한",
                            "EN": "I would recommend",
                            "SQ": "Une do te rekomandoja",
                            "SR": "Preporučio bih",
                            "RU": "Я советую",
                            "FR-CA": "Je recommande",
                            "TR": "Tavsiye ederim",
                            "ES": "Yo aconsejo",
                            "FR": "Je recommande",
                            "DE": "Ich rate"
                        },
                        
                    }
                ],
                key:  question.Payload.QuestionID
            },
            key: `P1E${index + 1}`,
            triggers: null
          };
          newFlow.states[0].elements.push(NPSQuestion);
        
      }
      else if(questionType === "Matrix" && selector === "Likert"){
        const matrixLikertQuestion = {
          type: "question",
          visible: true,
          detail: {
            required: false,
            style: "matrix",
            extra: {
              layout: "horizontal",
              spam_filter_on: true,
              matrix_answer_type: "single",
              matrix_question_type: "positivity"
            },
            body: {
              [surveyLanguage]: question.Payload.QuestionText
            },
            options: Object.entries(question.Payload.Answers).map(([answerId, answer], index) => ({
              body: {
                [surveyLanguage]: answer.Display
              },
              key: answer.Display,
              order: index,
              weight: 0,
            })),
            statements: Object.entries(question.Payload.Choices).map(([choiceId, choice], index) => ({
              body: {
                [surveyLanguage]: choice.Display
              },
              key: choice.Display,
              tag: `tag-${index}`,
              order: index,
              style: "plain",
              scale: Object.keys(question.Payload.Choices).length,
              options: Object.entries(question.Payload.Answers).map(([answerId, answer], optionIndex) => ({
                body: {
                  [surveyLanguage]: answer.Display,
                },
                key: choice.Display,
                order: optionIndex,
                weight: 0,
              }))
            })),
            key: question.Payload.QuestionID,
            scale: Object.keys(question.Payload.Choices).length
          },
          key: `P1E${index + 1}`,
          triggers: null
        };
        newFlow.states[0].elements.push(matrixLikertQuestion);
      }
    });
    newFlow.states[0].elements.push({
      type: "submit",
      visible: true,
      body: {
        [surveyLanguage]: "Submit",
        "FR-CA": "Envoyer",
        "ES-ES": "Enviar",
        ES: "Enviar"
      },
      key: `P1E${newFlow.states[0].elements.length + 1}`,
      detail: null,
      triggers: null
    });
    return newFlow;
  }
}

export default App;







