import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'Conaudio Docs',
    description: 'Conaudio migration and development documentation',

    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Migrations', link: '/migrations/' },
            { text: 'Testing', link: '/testing/' },
            { text: 'Development', link: '/dev-plan/dev-docs' },
            { text: 'Dev tools (Docker)', link: '/dev-tools/' }
        ],

        sidebar: [
            {
                text: 'Start',
                items: [
                    { text: 'Documentation Home', link: '/' },
                    { text: 'Writing Style Guide', link: '/docs-style' },
                    { text: 'Migration Overview', link: '/migrations/' },
                    { text: 'Testing Overview', link: '/testing/' }
                ]
            },
            {
                text: 'Development',
                items: [
                    { text: 'Development Notes', link: '/dev-plan/dev-docs' },
                    { text: 'Node and TypeScript Server Refactoring', link: '/dev-plan/node-typescript-server' },
                    { text: 'Active Todos', link: '/dev-plan/todos' },
                    { text: 'Saflib dev-tools & Docker', link: '/dev-tools/' }
                ]
            },
            {
                text: 'Migration References',
                items: [
                    { text: 'Migration Overview', link: '/migrations/' },
                    { text: 'Database HTTP API', link: '/migrations/db/' },
                    { text: 'Server Migration', link: '/migrations/server' },
                    { text: 'Data Layer Migration', link: '/migrations/data-layer' },
                    { text: 'Models Notes', link: '/migrations/models/' },
                    { text: 'Collections Notes', link: '/migrations/collections/' }
                ]
            },
            {
                text: 'Testing',
                items: [
                    { text: 'Testing Overview', link: '/testing/' },
                    { text: 'SDK Client Testing', link: '/testing/client' },
                    { text: 'Request Operation Testing', link: '/testing/request-operations' },
                    { text: 'Testing Todos', link: '/testing/todos' }
                ]
            },
            {
                text: 'Legacy Notes Archive',
                items: [
                    { text: 'Original Migration Notes', link: '/migrate' },
                    { text: 'Original Saflib Notes', link: '/saf-migrate' }
                ]
            }
        ]
    }
})
