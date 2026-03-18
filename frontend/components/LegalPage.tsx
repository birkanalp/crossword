interface Section {
  heading: string
  body: string | string[]
}

interface LegalPageProps {
  title: string
  lastUpdated: string
  sections: Section[]
}

export function LegalPage({ title, lastUpdated, sections }: LegalPageProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-400 mt-2">{lastUpdated}</p>
      </div>

      <div className="prose prose-gray max-w-none space-y-8">
        {sections.map((section) => (
          <div key={section.heading}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.heading}</h2>
            {Array.isArray(section.body) ? (
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm leading-relaxed">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 text-sm leading-relaxed">{section.body}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
