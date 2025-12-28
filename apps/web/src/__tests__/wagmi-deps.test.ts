import { execSync } from 'child_process'
import { describe, it, expect } from 'vitest'

const APPS = ['web']
const SINGLETONS = ['viem', '@wagmi/core']

function collectVersions(nodes: any[], pkgName: string): string[] {
  const versions = new Set<string>()

  function walk(node: any, nodeName?: string) {
    if (!node) return

    const name = nodeName || node.name

    if (name === pkgName && node.version) {
      versions.add(node.version)
    }

    if (node.dependencies) {
      for (const [depName, depNode] of Object.entries(node.dependencies)) {
        walk(depNode, depName)
      }
    }
  }

  if (Array.isArray(nodes)) {
    nodes.forEach((n) => walk(n))
  } else {
    walk(nodes)
  }

  return [...versions]
}

function getWorkspaceVersion(pkg: string, app: string): string | null {
  try {
    const output = execSync(`pnpm --silent --filter=${app}... list ${pkg} --prod --no-optional --depth 0 --json`, {
      encoding: 'utf-8',
    })
    const tree = JSON.parse(output)
    if (tree[0]?.dependencies?.[pkg]?.version) {
      return tree[0].dependencies[pkg].version
    }
  } catch {
    return null
  }
  return null
}

function compareVersions(v1: string, v2: string): number {
  const parse = (v: string) => v.split('.').map(Number)
  const [a1, b1, c1] = parse(v1)
  const [a2, b2, c2] = parse(v2)
  if (a1 !== a2) return a1 > a2 ? 1 : -1
  if (b1 !== b2) return b1 > b2 ? 1 : -1
  if (c1 !== c2) return c1 > c2 ? 1 : -1
  return 0
}

describe('singleton dependency check', () => {
  for (const app of APPS) {
    describe(app, () => {
      const workspaceVersions = new Map<string, string | null>()

      for (const pkg of SINGLETONS) {
        it(`${pkg} should not exceed workspace version`, () => {
          let workspaceVersion = workspaceVersions.get(pkg)
          if (!workspaceVersion) {
            workspaceVersion = getWorkspaceVersion(pkg, app)
            workspaceVersions.set(pkg, workspaceVersion)
          }

          if (!workspaceVersion) {
            console.warn(`Workspace version for ${pkg} not found.`)
            return
          }

          const cmd = `pnpm --silent --filter=${app}... list ${pkg} --prod --no-optional --depth Infinity --json`
          const output = execSync(cmd, { encoding: 'utf-8' })
          const tree = JSON.parse(output)

          const versions = collectVersions(tree, pkg)

          const higherVersions = versions.filter((v) => compareVersions(v, workspaceVersion) > 0)

          if (higherVersions.length > 0) {
            console.error(`[${app}] ${pkg} versions exceed workspace version (${workspaceVersion}):`, higherVersions)
          }

          expect(higherVersions.length).toBe(0)
        })
      }
    })
  }
})
