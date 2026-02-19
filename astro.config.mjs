// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://anglican.wiki',
	integrations: [
		starlight({
			title: 'Anglican Wiki',
			components: {
				PageTitle: './src/components/PageTitle.astro',
			},
			customCss: [
				'@fontsource/eb-garamond/400.css',
				'@fontsource/eb-garamond/700.css',
				'./src/styles/custom.css',
			],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/StephenStrickland/anglican-wiki' }],
			sidebar: [
				{
					label: 'Books of Common Prayer',
					items: [
						{ label: 'BCP 1662', slug: 'bcp-1662' },
						{ label: 'BCP 1770 — Church Catechism', slug: 'bcp-1770/church-catechism' },
						{ label: 'BCP 1928', slug: 'bcp-1928' },
						{ label: 'BCP 1962 — Canadian', slug: 'bcp-1962' },
						{ label: 'BCP 2019', slug: 'bcp-2019' },
						{ label: 'BCP 2005 — REC', slug: 'bcp-rec-2005' },
					],
				},
				{
					label: 'Anglican Divines',
					items: [
						{
							label: 'John Jewel',
							items: [
								{ slug: 'anglican-divines/john-jewel' },
								{
									label: 'Apology of the Church of England',
									collapsed: true,
									autogenerate: { directory: 'anglican-divines/john-jewel/apology' },
								},
							],
							collapsed: true,
						},
					],
				},
				{
					label: 'Oxford Movement',
					collapsed: true,
					items: [
						{
							label: 'Tracts for the Times',
							collapsed: true,
							autogenerate: { directory: 'tracts' },
						},
						{
							label: 'John Keble',
							collapsed: true,
							autogenerate: { directory: 'keble' },
						},
						{
							label: 'E.B. Pusey',
							collapsed: true,
							autogenerate: { directory: 'pusey' },
						},
						{
							label: 'Henry Liddon',
							collapsed: true,
							autogenerate: { directory: 'liddon' },
						},
					],
				},
				{
					label: 'Caroline Divines & LACT',
					collapsed: true,
					items: [
						{
							label: 'Richard Hooker',
							collapsed: true,
							autogenerate: { directory: 'hooker' },
						},
						{
							label: 'Library of Anglo-Catholic Theology',
							collapsed: true,
							autogenerate: { directory: 'lact' },
						},
						{
							label: 'Caroline Divines',
							collapsed: true,
							autogenerate: { directory: 'caroline' },
						},
					],
				},
				{
					label: 'Later Anglican Theology',
					collapsed: true,
					items: [
						{
							label: 'Charles Gore',
							collapsed: true,
							autogenerate: { directory: 'gore' },
						},
						{
							label: 'Charles Chapman Grafton',
							collapsed: true,
							autogenerate: { directory: 'grafton' },
						},
						{
							label: 'Percy Dearmer',
							collapsed: true,
							autogenerate: { directory: 'dearmer' },
						},
						{
							label: 'John Mason Neale',
							collapsed: true,
							autogenerate: { directory: 'neale' },
						},
					],
				},
				{
					label: 'Liturgy & Worship',
					collapsed: true,
					items: [
						{
							label: 'Liturgical Texts',
							collapsed: true,
							autogenerate: { directory: 'liturgy' },
						},
						{
							label: 'BCP Documents',
							collapsed: true,
							autogenerate: { directory: 'bcp-historical' },
						},
					],
				},
				{
					label: 'Historical Documents',
					collapsed: true,
					items: [
						{
							label: 'English Reformation',
							collapsed: true,
							autogenerate: { directory: 'reformation' },
						},
						{
							label: 'Nonjurors',
							collapsed: true,
							autogenerate: { directory: 'nonjurors' },
						},
						{
							label: 'Biographies',
							collapsed: true,
							autogenerate: { directory: 'bios' },
						},
						{
							label: 'Essays',
							collapsed: true,
							autogenerate: { directory: 'essays' },
						},
					],
				},
				{
					label: 'Resources',
					autogenerate: { directory: 'resources' },
				},
			],
		}),
	],
});
